/**
 * P4-C Crew：Supervisor 端到端（mock AI）+ metadata.agentSteps 持久化
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AgentRunInput, AiRuntime } from '@rxwf/ai-runtime-stub';
import {
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

function supervisorCrewDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Supervisor Crew Test',
    settings: { workflowKind: 'agent' as const },
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'sup',
        type: 'crewSupervisor',
        name: 'Supervisor',
        position: { x: 200, y: 0 },
        parameters: {
          maxSteps: 5,
          supervisorProvider: 'ollama',
          supervisorModel: 'llama3',
        },
      },
      {
        id: 'w1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 120 },
        parameters: { role: 'Researcher', goal: 'Research' },
      },
      {
        id: 'mdl-w',
        type: 'aiChatModel',
        name: 'Model W',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't-w',
        type: 'toolHttp',
        name: 'Tool W',
        position: { x: 80, y: 300 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'Researcher tool',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'sup' },
      { from: 'w1', to: 'sup', fromOutput: 'crew_member', toInput: 'crew_member' },
      {
        from: 'mdl-w',
        to: 'w1',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
      { from: 't-w', to: 'w1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

describe('P4-C crew integration (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let chat: ReturnType<typeof vi.fn>;
  let runAgent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await createTestDb();
    const users = createUserService(db);
    const user = await users.createUser({
      email: 'p4c-crew@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    const supervisorResponses = [
      '{"action":"run","member":"Researcher","task":"analyze topic"}',
      '{"action":"finish","answer":"crew final answer"}',
    ];
    chat = vi.fn(async function* () {
      yield supervisorResponses.shift() ?? '{"action":"finish","answer":"ok"}';
    });
    runAgent = vi.fn(async (_input: AgentRunInput) => ({
      items: [{ json: { answer: 'worker output' } }],
    }));

    const ai = { chat, runAgent } as unknown as AiRuntime;
    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      { featurePlus: true, ai },
    );

    const created = await workflows.create({
      name: 'P4C Supervisor Crew',
      definition: supervisorCrewDefinition(),
    });
    workflowId = created.id;
    await workflows.publish(workflowId, user.id);
  });

  async function runOnce() {
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

  it('crewSupervisor completes with worker delegation and final answer', async () => {
    chat.mockClear();
    runAgent.mockClear();
    await runOnce();

    expect(chat).toHaveBeenCalled();
    expect(runAgent).toHaveBeenCalledTimes(1);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'sup'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');
    expect(last?.nodeType).toBe('crewSupervisor');

    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const json = output?.[0]?.[0]?.json;
    expect(json?.answer).toBe('crew final answer');
    expect(json?.process).toBe('supervisor');
    expect(json?.crewSteps).toHaveLength(1);
    expect(json?.crewSteps[0]?.name).toBe('Researcher');
    expect(json?.supervisorSteps?.length).toBeGreaterThanOrEqual(1);
  });

  it('persists agentSteps on crewSupervisor node run metadata', async () => {
    await runOnce();
    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'sup'));
    const last = runs.at(-1);
    const meta = last?.metadata ? JSON.parse(last.metadata) : null;
    expect(meta?.agentSteps?.length).toBeGreaterThan(0);
    const hasOrchestratorStep = meta.agentSteps.some(
      (s: { type: string; output?: { supervisor?: string } }) =>
        s.type === 'agent_step' && s.output?.supervisor != null,
    );
    expect(hasOrchestratorStep).toBe(true);
  });
});
