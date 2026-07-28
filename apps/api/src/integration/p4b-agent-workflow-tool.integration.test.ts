/**
 * P4-B Workflow Tool：published 子工作流 + 嵌套深度 E2008
 * P4-B′：published + settings.exposeAsTool
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AgentRunInput, AiExecutionContext, AiRuntime } from '@rxwf/ai-runtime-stub';
import {
  createLiteAgentMemoryRepository,
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createUserService } from '@rxwf/identity';
import { createWorkflowService } from '@rxwf/workflow';
import { createExecutionRuntime } from '../execution/create-execution-runtime.js';

const jobsTable = liteSchema.jobs;
const nodeRunsTable = liteSchema.nodeRuns;

async function seedTestUser(db: LiteDatabase): Promise<string> {
  const users = createUserService(db);
  const user = await users.createUser({
    email: `p4b-wf-tool-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role: 'admin',
  });
  return user.id;
}

function childSetWorkflowDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Child Set',
    settings: { exposeAsTool: true },
    nodes: [
      {
        id: 'tr',
        type: 'subworkflowTrigger',
        name: 'SubStart',
        position: { x: 0, y: 0 },
        parameters: { inputMode: 'acceptAll' },
      },
      {
        id: 'set',
        type: 'set',
        name: 'Mark',
        position: { x: 100, y: 0 },
        parameters: { fields: { ok: true } },
      },
    ],
    connections: [{ from: 'tr', to: 'set' }],
  };
}

function agentWithToolWorkflowDefinition(childWorkflowId: string) {
  return {
    schemaVersion: 1 as const,
    name: 'Agent WF Tool',
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'agt',
        type: 'aiAgent',
        name: 'Agent',
        position: { x: 200, y: 0 },
        parameters: { sessionId: '' },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 80 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'twf',
        type: 'toolWorkflow',
        name: 'RunChild',
        position: { x: 200, y: 80 },
        parameters: {
          workflowId: childWorkflowId,
          toolDescription: 'Run child workflow synchronously',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      {
        from: 'mdl',
        to: 'agt',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
      { from: 'twf', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

function depthChainDefinition(targetWorkflowId: string) {
  return {
    schemaVersion: 1 as const,
    name: 'Depth Chain',
    settings: { exposeAsTool: true },
    nodes: [
      {
        id: 'tr',
        type: 'subworkflowTrigger',
        name: 'SubStart',
        position: { x: 0, y: 0 },
        parameters: { inputMode: 'acceptAll' },
      },
      {
        id: 'sw',
        type: 'executeWorkflow',
        name: 'Next',
        position: { x: 100, y: 0 },
        parameters: { workflowId: targetWorkflowId },
      },
    ],
    connections: [{ from: 'tr', to: 'sw' }],
  };
}

describe('P4-B agent toolWorkflow integration (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let childWorkflowId: string;
  let parentWorkflowId: string;
  let runAgent: ReturnType<typeof vi.fn>;
  let testUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    testUserId = await seedTestUser(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    runAgent = vi.fn(async (input: AgentRunInput, ctx: AiExecutionContext) => {
      const wfTool = input.tools.find((t) => t.source.type === 'workflow');
      if (wfTool && input.invokeTool) {
        ctx.onStream?.({ type: 'tool_start', tool: wfTool.name, input: {} });
        try {
          const out = await input.invokeTool(wfTool, {});
          ctx.onStream?.({ type: 'tool_end', tool: wfTool.name, output: out });
          return {
            items: [{ json: { answer: 'child ok', childOutput: out } }],
          };
        } catch {
          ctx.onStream?.({
            type: 'tool_end',
            tool: wfTool.name,
            output: { error: 'workflow tool failed' },
          });
          return { items: [{ json: { answer: 'tool failed' } }] };
        }
      }
      return { items: [{ json: { answer: 'no tool' } }] };
    });

    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;
    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai,
        agentMemory: createLiteAgentMemoryRepository(db),
      },
    );

    const child = await workflows.create({
      name: 'P4B Child',
      definition: childSetWorkflowDefinition(),
    });
    childWorkflowId = child.id;
    await workflows.publish(childWorkflowId, testUserId);

    const parent = await workflows.create({
      name: 'P4B Parent WF Tool',
      definition: agentWithToolWorkflowDefinition(childWorkflowId),
    });
    parentWorkflowId = parent.id;
    await workflows.publish(parentWorkflowId, testUserId);
  });

  async function enqueueManual(workflowId: string) {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({
        workflowId,
        triggerType: 'manual',
      }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('invokes published child workflow via toolWorkflow', async () => {
    runAgent.mockClear();
    await enqueueManual(parentWorkflowId);
    expect(runAgent).toHaveBeenCalled();
    const input = runAgent.mock.calls[0]![0] as AgentRunInput;
    expect(input.tools.some((t) => t.source.type === 'workflow')).toBe(true);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'agt'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');
    const meta = last?.metadata ? JSON.parse(last.metadata) : null;
    expect(meta?.agentSteps?.length).toBeGreaterThan(0);
    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    expect(output?.[0]?.[0]?.json?.answer).toBe('child ok');
  });

  it('fails with E2008 when subworkflow nesting exceeds limit', async () => {
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    const leaf = await workflows.create({
      name: 'Depth Leaf',
      definition: childSetWorkflowDefinition(),
    });
    await workflows.publish(leaf.id, testUserId);

    let nextId = leaf.id;
    for (let i = 0; i < 6; i++) {
      const layer = await workflows.create({
        name: `Depth ${i}`,
        definition: depthChainDefinition(nextId),
      });
      await workflows.publish(layer.id, testUserId);
      nextId = layer.id;
    }

    const depthParent = await workflows.create({
      name: 'Depth Agent Parent',
      definition: agentWithToolWorkflowDefinition(nextId),
    });
    await workflows.publish(depthParent.id, testUserId);

    runAgent.mockClear();
    await enqueueManual(depthParent.id);

    const allRuns = await db.select().from(nodeRunsTable);
    const depthFailure = allRuns.find((r) => r.errorCode === 'E2008');
    expect(depthFailure).toBeTruthy();
    expect(depthFailure?.nodeType).toBe('executeWorkflow');
  });
});
