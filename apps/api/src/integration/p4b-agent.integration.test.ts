/**
 * P4-B AI Agent：AC-B2（Agent + toolMcp）、AC-B3（session memory）、AC-B5 Lite 冒烟
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
import { createWorkflowService } from '@rxwf/workflow';
import { createExecutionRuntime } from '../execution/create-execution-runtime.js';
import { createUserService } from '@rxwf/identity';

const jobsTable = liteSchema.jobs;
const nodeRunsTable = liteSchema.nodeRuns;
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

function agentWorkflowDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Agent Test',
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
        id: 'tool',
        type: 'toolMcp',
        name: 'ListDir',
        position: { x: 200, y: 80 },
        parameters: {
          serverId: 'srv-1',
          tools: ['list_directory'],
          toolDescription: 'List files in a directory',
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
      { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

describe('P4-B agent integration (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let callMcpTool: ReturnType<typeof vi.fn>;
  let runAgent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const publishUserId = (await createUserService(db).createUser({ email: `p4b-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    callMcpTool = vi.fn(async () => ({ entries: ['a.txt'] }));

    runAgent = vi.fn(async (input: AgentRunInput, ctx: AiExecutionContext) => {
      const toolName = input.tools[0]?.name ?? 'ListDir';
      ctx.onStream?.({ type: 'tool_start', tool: toolName, input: { path: '/' } });
      if (input.tools.length > 0 && input.invokeTool) {
        await input.invokeTool(input.tools[0]!, { path: '/' });
      }
      ctx.onStream?.({
        type: 'tool_end',
        tool: toolName,
        output: { entries: ['a.txt'] },
      });
      return {
        items: [{ json: { answer: 'done', agentSteps: [{ tool: input.tools[0]?.name }] } }],
        intermediateSteps: [{ tool: input.tools[0]?.name }],
      };
    });

    const ai = { chat: async function* () {}, runAgent } as unknown as AiRuntime;
    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai,
        callMcpTool,
        agentMemory: createLiteAgentMemoryRepository(db),
      },
    );

    const created = await workflows.create({
      name: 'P4B Agent',
      definition: agentWorkflowDefinition(),
    });
    workflowId = created.id;
    await workflows.publish(workflowId, publishUserId);
  });

  async function enqueueManual(sessionId?: string) {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({
        workflowId,
        triggerType: 'manual',
        sessionId,
      }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('AC-B2: Agent + toolMcp completes with MCP tool invocation', async () => {
    callMcpTool.mockClear();
    runAgent.mockClear();
    await enqueueManual('sess-ac-b2');
    expect(runAgent).toHaveBeenCalled();
    expect(callMcpTool).toHaveBeenCalled();
    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'agt'));
    const last = runs[runs.length - 1];
    expect(last?.status).toBe('success');
    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const answer = output?.[0]?.[0]?.json?.answer;
    expect(answer).toBe('done');
  });

  it('persists agentSteps on node run metadata', async () => {
    await enqueueManual('sess-metadata');
    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'agt'));
    const last = runs.at(-1);
    const meta = last?.metadata ? JSON.parse(last.metadata) : null;
    expect(meta?.agentSteps?.length).toBeGreaterThan(0);
  });

  it('debugNode resolves {{ $json.prompt }} before Chat Model invoke', async () => {
    runAgent.mockClear();
    const def = {
      ...agentWorkflowDefinition(),
      nodes: [
        {
          id: 'tr',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'set',
          type: 'set',
          name: 'Set prompt',
          position: { x: 100, y: 0 },
          parameters: {
            mode: 'manual',
            fields: { prompt: 'resolved-from-upstream' },
          },
        },
        {
          id: 'agt',
          type: 'aiAgent',
          name: 'Agent',
          position: { x: 200, y: 0 },
          parameters: {
            prompt: '{{ $json.prompt }}',
            systemPrompt: '你是C++开发工程师',
          },
        },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 0, y: 80 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'tool',
          type: 'toolMcp',
          name: 'ListDir',
          position: { x: 200, y: 80 },
          parameters: {
            serverId: 'srv-1',
            tools: ['list_directory'],
            toolDescription: 'List files in a directory',
          },
        },
      ],
      connections: [
        { from: 'tr', to: 'set' },
        { from: 'set', to: 'agt' },
        {
          from: 'mdl',
          to: 'agt',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
        { from: 'tool', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    };

    const result = await runtime.debugNode({
      definition: def,
      targetNodeId: 'agt',
      workflowId,
      environment: 'test',
    });

    expect(result.status).toBe('success');
    expect(runAgent).toHaveBeenCalled();
    const input = runAgent.mock.calls.at(-1)![0] as AgentRunInput;
    expect(input.userMessage).toBe('resolved-from-upstream');
    expect(input.systemPrompt).toContain('你是C++开发工程师');
  });

  it('AC-B3: second run with same sessionId receives prior user history', async () => {
    const session = 'sess-ac-b3';
    runAgent.mockClear();
    await enqueueManual(session);
    await enqueueManual(session);
    expect(runAgent.mock.calls.length).toBeGreaterThanOrEqual(2);
    const secondInput = runAgent.mock.calls[1]![0] as AgentRunInput;
    const priorUser = (secondInput.history ?? []).some(
      (m) => m.role === 'user' && m.content.length > 0,
    );
    expect(priorUser).toBe(true);
  });
});
