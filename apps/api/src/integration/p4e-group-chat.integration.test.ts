/**
 * P4-E Group Chat：round-robin 端到端 + UserProxy HITL resume（mock AI）
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
const executionsTable = liteSchema.executions;
const nodeRunsTable = liteSchema.nodeRuns;

function groupChatRoundRobinDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Group Chat Round Robin',
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
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 200, y: 0 },
        parameters: { maxRounds: 2, speakerSelection: 'roundRobin' },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Analyst',
        position: { x: 0, y: 120 },
        parameters: { role: 'Analyst', goal: 'Analyze' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Reviewer',
        position: { x: 160, y: 120 },
        parameters: { role: 'Reviewer', goal: 'Review' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  };
}

function groupChatUserProxyDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Group Chat UserProxy',
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
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 200, y: 0 },
        parameters: {
          maxRounds: 2,
          speakerSelection: 'roundRobin',
          userProxyEnabled: true,
          userProxyEveryNRounds: 2,
        },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'A',
        position: { x: 0, y: 120 },
        parameters: { role: 'A', goal: 'Discuss' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'B',
        position: { x: 160, y: 120 },
        parameters: { role: 'B', goal: 'Discuss' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  };
}

function groupChatOrchestratorDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Group Chat Orchestrator',
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
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 200, y: 0 },
        parameters: {
          maxRounds: 3,
          speakerSelection: 'orchestrator',
          orchestratorProvider: 'ollama',
          orchestratorModel: 'llama3',
        },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Analyst',
        position: { x: 0, y: 120 },
        parameters: { role: 'Analyst', goal: 'Analyze' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Reviewer',
        position: { x: 160, y: 120 },
        parameters: { role: 'Reviewer', goal: 'Review' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  };
}

describe('P4-E group chat integration (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let roundRobinWorkflowId: string;
  let userProxyWorkflowId: string;
  let orchestratorWorkflowId: string;
  let chat: ReturnType<typeof vi.fn>;
  let runAgent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await createTestDb();
    const users = createUserService(db);
    const user = await users.createUser({
      email: 'p4e-group@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    chat = vi.fn(async function* () {
      yield '{"action":"speak","member":"Analyst","reason":"start"}';
      yield '{"action":"finish","answer":"orchestrator final"}';
    });
    runAgent = vi.fn(async (_input: AgentRunInput) => ({
      items: [{ json: { answer: 'member reply' } }],
    }));

    const ai = { chat, runAgent } as unknown as AiRuntime;
    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      { featurePlus: true, ai },
    );

    const rr = await workflows.create({
      name: 'P4E Group RR',
      definition: groupChatRoundRobinDefinition(),
    });
    roundRobinWorkflowId = rr.id;
    await workflows.publish(roundRobinWorkflowId, user.id);

    const up = await workflows.create({
      name: 'P4E Group UserProxy',
      definition: groupChatUserProxyDefinition(),
    });
    userProxyWorkflowId = up.id;
    await workflows.publish(userProxyWorkflowId, user.id);

    const orch = await workflows.create({
      name: 'P4E Group Orchestrator',
      definition: groupChatOrchestratorDefinition(),
    });
    orchestratorWorkflowId = orch.id;
    await workflows.publish(orchestratorWorkflowId, user.id);
  });

  async function runWorkflow(workflowId: string) {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({ workflowId, triggerType: 'manual' }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('AC-E2: round-robin group chat completes with transcript and agentSteps', async () => {
    runAgent.mockClear();
    await runWorkflow(roundRobinWorkflowId);

    expect(runAgent).toHaveBeenCalledTimes(2);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'gc'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');
    expect(last?.nodeType).toBe('groupChat');

    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const json = output?.[0]?.[0]?.json;
    expect(Array.isArray(json?.transcript)).toBe(true);
    expect((json.transcript as unknown[]).length).toBeGreaterThanOrEqual(2);

    const meta = last?.metadata ? JSON.parse(last.metadata) : null;
    expect(
      meta?.agentSteps?.some(
        (s: { output?: { type: string } }) => s.output?.type === 'groupChatTurn',
      ),
    ).toBe(true);
  });

  it('AC-21: UserProxy pauses at groupChat then resumes with user supplement', async () => {
    runAgent.mockClear();
    await runWorkflow(userProxyWorkflowId);

    const exec = (await db.select().from(executionsTable)).at(-1)!;
    expect(exec.status).toBe('waiting');

    const waitingRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'gc'));
    const waiting = waitingRuns.at(-1);
    expect(waiting?.status).toBe('waiting');
    expect(runAgent).toHaveBeenCalledTimes(1);

    const resumed = await runtime.resumeHitl({
      executionId: exec.id,
      nodeId: 'gc',
      decision: 'approve',
      supplement: 'Please focus on security risks',
    });
    expect(resumed.status).toBe('success');

    const afterExec = (await db.select().from(executionsTable)).find((e) => e.id === exec.id);
    expect(afterExec?.status).toBe('success');

    const successRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'gc'));
    const finalRun = successRuns.at(-1);
    expect(finalRun?.status).toBe('success');

    const output = finalRun?.outputData ? JSON.parse(finalRun.outputData) : null;
    const transcript = output?.[0]?.[0]?.json?.transcript as Array<{ author: string; content: string }>;
    expect(transcript.some((m) => m.author === 'User' && m.content.includes('security'))).toBe(true);
    expect(runAgent.mock.calls.length).toBeGreaterThan(1);
  });

  it('orchestrator mode delegates via chat and finishes', async () => {
    let orchChatCalls = 0;
    chat.mockImplementation(async function* () {
      orchChatCalls += 1;
      if (orchChatCalls === 1) {
        yield '{"action":"speak","member":"Analyst","reason":"start"}';
        return;
      }
      yield '{"action":"finish","answer":"orchestrator final"}';
    });
    runAgent.mockClear();
    chat.mockClear();
    await runWorkflow(orchestratorWorkflowId);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'gc'));
    const last = runs.at(-1);

    expect(chat).toHaveBeenCalled();
    expect(last?.status).toBe('success');
    const json = last?.outputData ? JSON.parse(last.outputData)?.[0]?.[0]?.json : null;
    expect(json?.answer).toBe('orchestrator final');
    expect(runAgent.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
