/**
 * P4-D CrewAI：AC-D1.1（CrewAI kickoff 成功）、AC-D1.3（native 顺序 Crew 回归）
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AgentRunInput, AiRuntime } from '@rxwf/ai-runtime-stub';
import type { CrewAiClient } from '@rxwf/node-runner';
import type { WorkflowDefinition } from '@rxwf/workflow';
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

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

async function seedTestUser(db: LiteDatabase): Promise<string> {
  const users = createUserService(db);
  const user = await users.createUser({
    email: `p4d-crewai-${crypto.randomUUID()}@example.com`,
    password: 'secret1234',
    role: 'admin',
  });
  return user.id;
}

function loadFixture(name: string): WorkflowDefinition {
  const raw = readFileSync(join(repoRoot, 'fixtures/templates', name), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const { category: _category, description: _description, ...definition } = parsed;
  return definition as WorkflowDefinition;
}

function nativeSequentialDefinition(): WorkflowDefinition {
  const def = loadFixture('agent-crew-sequential-crewai.json');
  const crewNode = def.nodes.find((n) => n.id === 'crew');
  if (crewNode) {
    crewNode.parameters = {};
  }
  return def;
}

describe('P4-D CrewAI backend (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let kickoff: ReturnType<typeof vi.fn>;
  let testUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    testUserId = await seedTestUser(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db), {
      validateOptions: { crewaiRunnerConfigured: true },
    });

    kickoff = vi.fn(async () => ({
      status: 'success' as const,
      answer: 'crewai final answer',
      crewSteps: [
        { name: 'Researcher', answer: 'research summary' },
        { name: 'Writer', answer: 'crewai final answer' },
      ],
    }));

    const crewAiClient = {
      kickoff,
      kickoffStream: kickoff,
      health: vi.fn(async () => true),
    } satisfies CrewAiClient;

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai: { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime,
        callMcpTool: vi.fn(async () => ({ entries: ['a.txt'] })),
        crewAiClient,
      },
    );

    const created = await workflows.create({
      name: 'P4D CrewAI Sequential',
      definition: loadFixture('agent-crew-sequential-crewai.json'),
    });
    workflowId = created.id;
    await workflows.publish(workflowId, testUserId);
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

  it('AC-D1.1: mock crewAiClient.kickoff success completes with answer', async () => {
    kickoff.mockClear();
    await runOnce();

    expect(kickoff).toHaveBeenCalledTimes(1);
    const ir = kickoff.mock.calls[0]![0];
    expect(ir.executionBackend).toBe('crewai');
    expect(ir.process).toBe('sequential');
    expect(ir.members).toHaveLength(2);
    expect(ir.members[0]?.tools[0]?.type).toBe('mcp');

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'crew'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');
    expect(last?.nodeType).toBe('crewSequential');

    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const json = output?.[0]?.[0]?.json;
    expect(json?.answer).toBe('crewai final answer');
    expect(json?.process).toBe('sequential');
    expect(json?.crewSteps).toHaveLength(2);
  });
});

describe('P4-D native crew sequential regression (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let kickoff: ReturnType<typeof vi.fn>;
  let runAgent: ReturnType<typeof vi.fn>;
  let testUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    testUserId = await seedTestUser(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    const answers = ['research summary', 'native final answer'];
    runAgent = vi.fn(async (_input: AgentRunInput) => ({
      items: [{ json: { answer: answers.shift() ?? 'done' } }],
    }));
    kickoff = vi.fn(async () => ({
      status: 'success' as const,
      answer: 'should-not-be-used',
    }));

    const crewAiClient = {
      kickoff,
      kickoffStream: kickoff,
      health: vi.fn(async () => true),
    } satisfies CrewAiClient;

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai: { chat: async function* () {}, runAgent } as unknown as AiRuntime,
        callMcpTool: vi.fn(async () => ({ entries: ['a.txt'] })),
        crewAiClient,
      },
    );

    const created = await workflows.create({
      name: 'P4D Native Sequential',
      definition: nativeSequentialDefinition(),
    });
    workflowId = created.id;
    await workflows.publish(workflowId, testUserId);
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

  it('AC-D1.3: native crew sequential still works without executionBackend', async () => {
    kickoff.mockClear();
    runAgent.mockClear();
    await runOnce();

    expect(kickoff).not.toHaveBeenCalled();
    expect(runAgent).toHaveBeenCalledTimes(2);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'crew'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');
    expect(last?.nodeType).toBe('crewSequential');

    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const json = output?.[0]?.[0]?.json;
    expect(json?.answer).toBe('native final answer');
    expect(json?.crewSteps).toHaveLength(2);
    expect(json?.crewSteps[0]?.name).toBe('Researcher');
    expect(json?.crewSteps[1]?.name).toBe('Writer');
  });
});

describe('P4-D2 crewSupervisor + crewai IR mapping (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let kickoff: ReturnType<typeof vi.fn>;
  let testUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    testUserId = await seedTestUser(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db), {
      validateOptions: { crewaiRunnerConfigured: true },
    });

    kickoff = vi.fn(async () => ({
      status: 'success' as const,
      answer: 'supervisor crewai answer',
      crewSteps: [],
    }));

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai: { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime,
        callMcpTool: vi.fn(async () => ({})),
        crewAiClient: {
          kickoff,
          kickoffStream: kickoff,
          health: vi.fn(async () => true),
        },
      },
    );

    const def = loadFixture('agent-crew-supervisor.json');
    const sup = def.nodes.find((n) => n.id === 'sup');
    if (sup) {
      sup.parameters = { ...sup.parameters, executionBackend: 'crewai' };
    }

    const created = await workflows.create({
      name: 'P4D CrewAI Supervisor',
      definition: def,
    });
    workflowId = created.id;
    await workflows.publish(workflowId, testUserId);
  });

  async function runOnce() {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({ workflowId, triggerType: 'manual' }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('compiles supervisor process with manager in IR for crewai kickoff', async () => {
    kickoff.mockClear();
    await runOnce();

    expect(kickoff).toHaveBeenCalledTimes(1);
    const ir = kickoff.mock.calls[0]![0];
    expect(ir.process).toBe('supervisor');
    expect(ir.manager).toBeDefined();
    expect(ir.members.length).toBeGreaterThanOrEqual(2);

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'sup'));
    expect(runs.at(-1)?.status).toBe('success');
  });
});

describe('P4-D3 crewai flow mode + crewEval (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let kickoff: ReturnType<typeof vi.fn>;
  let testUserId: string;

  beforeAll(async () => {
    db = await createTestDb();
    testUserId = await seedTestUser(db);
    const workflows = createWorkflowService(createLiteWorkflowRepository(db), {
      validateOptions: { crewaiRunnerConfigured: true },
    });

    kickoff = vi.fn(async () => ({
      status: 'success' as const,
      answer: 'flow eval answer',
      crewSteps: [{ name: 'Researcher', flowNodeId: 'flow_task_r1' }],
      crewEval: {
        overallScore: 0.85,
        criteria: [{ name: 'coverage', score: 1, notes: '1/2 flow tasks' }],
      },
    }));

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ai: { chat: async function* () {}, runAgent: vi.fn() } as unknown as AiRuntime,
        callMcpTool: vi.fn(async () => ({ entries: ['a.txt'] })),
        crewAiClient: {
          kickoff,
          kickoffStream: kickoff,
          health: vi.fn(async () => true),
        },
      },
    );

    const def = loadFixture('agent-crew-sequential-crewai.json');
    const crew = def.nodes.find((n) => n.id === 'crew');
    if (crew) {
      crew.parameters = {
        executionBackend: 'crewai',
        crewaiFlowMode: 'flow',
        enableEval: true,
      };
    }

    const created = await workflows.create({
      name: 'P4D CrewAI Flow',
      definition: def,
    });
    workflowId = created.id;
    await workflows.publish(workflowId, testUserId);
  });

  async function runOnce() {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({ workflowId, triggerType: 'manual' }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('passes flowGraph in IR and persists crewEval on node run', async () => {
    kickoff.mockClear();
    await runOnce();

    const ir = kickoff.mock.calls[0]![0];
    expect(ir.crewParams?.crewaiFlowMode).toBe('flow');
    expect(ir.crewParams?.enableEval).toBe(true);
    expect(ir.flowGraph?.entryNodeId).toBe('flow_start');

    const runs = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'crew'));
    const last = runs.at(-1);
    expect(last?.status).toBe('success');

    const output = last?.outputData ? JSON.parse(last.outputData) : null;
    const json = output?.[0]?.[0]?.json;
    expect(json?.crewEval?.overallScore).toBe(0.85);

    const metadata = last?.metadata ? JSON.parse(last.metadata) : null;
    expect(metadata?.crewEval?.overallScore).toBe(0.85);
  });
});
