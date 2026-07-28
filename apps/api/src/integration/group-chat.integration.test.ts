/**
 * M-4 Group Chat API：orchestrationResume kind=groupChat HITL resume 路由集成
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { eq } from 'drizzle-orm';
import type { AgentRunInput, AiRuntime } from '@rxwf/ai-runtime-stub';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthPreHandler } from '../middleware/auth.js';
import { createExecutionRuntime } from '../execution/create-execution-runtime.js';
import { registerHitlResumeRoutes } from '../routes/hitl-resume.js';

const jobsTable = liteSchema.jobs;
const executionsTable = liteSchema.executions;
const nodeRunsTable = liteSchema.nodeRuns;

function groupChatUserProxyDefinition() {
  return {
    schemaVersion: 1 as const,
    name: 'Group Chat UserProxy API',
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

describe('Group Chat HITL resume API integration', () => {
  let db: LiteDatabase;
  let app: ReturnType<typeof Fastify>;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let apiKey: string;
  let workflowId: string;
  let runAgent: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await createTestDb();
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'gc-api@example.com',
      password: 'secret1234',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(user.id, 'gc-api')).key;

    runAgent = vi.fn(async (_input: AgentRunInput) => ({
      items: [{ json: { answer: 'member reply' } }],
    }));
    const ai = { runAgent } as unknown as AiRuntime;
    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      { featurePlus: true, ai },
    );

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const created = await workflows.create({
      name: 'GC API Resume',
      definition: groupChatUserProxyDefinition(),
    });
    workflowId = created.id;
    await workflows.publish(workflowId, user.id);

    app = Fastify({ logger: false });
    const authPreHandler = createAuthPreHandler(auth);
    registerHitlResumeRoutes(app, authPreHandler, runtime);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await runtime.close?.();
  });

  async function enqueueWorkflow() {
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      kind: 'execution.enqueue',
      payload: JSON.stringify({ workflowId, triggerType: 'manual' }),
      status: 'pending',
      createdAt: new Date(),
    });
    await runtime.jobProcessor.processOnce();
  }

  it('resume 404 for non-existent execution', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/executions/non-existent-exec-id/hitl/resume',
      headers: { 'x-api-key': apiKey },
      payload: { decision: 'approve', supplement: 'hello' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'E1001' });
  });

  it('UserProxy waiting resumes via API with orchestrationResume kind=groupChat', async () => {
    runAgent.mockClear();
    await enqueueWorkflow();

    const exec = (await db.select().from(executionsTable)).at(-1)!;
    expect(exec.status).toBe('waiting');

    const res = await app.inject({
      method: 'POST',
      url: `/api/executions/${exec.id}/hitl/resume`,
      headers: { 'x-api-key': apiKey },
      payload: {
        nodeId: 'gc',
        decision: 'approve',
        supplement: 'Please focus on security risks',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'success' });

    const afterExec = (await db.select().from(executionsTable)).find((e) => e.id === exec.id);
    expect(afterExec?.status).toBe('success');

    const successRuns = await db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.nodeId, 'gc'));
    const finalRun = successRuns.at(-1);
    expect(finalRun?.status).toBe('success');

    const output = finalRun?.outputData ? JSON.parse(finalRun.outputData) : null;
    const transcript = output?.[0]?.[0]?.json?.transcript as Array<{
      author: string;
      content: string;
    }>;
    expect(transcript.some((m) => m.author === 'User' && m.content.includes('security'))).toBe(
      true,
    );
    expect(runAgent.mock.calls.length).toBeGreaterThan(1);
  });

  it('rejects approve without supplement on groupChat UserProxy waiting', async () => {
    runAgent.mockClear();
    await enqueueWorkflow();

    const exec = (await db.select().from(executionsTable)).at(-1)!;
    expect(exec.status).toBe('waiting');

    const res = await app.inject({
      method: 'POST',
      url: `/api/executions/${exec.id}/hitl/resume`,
      headers: { 'x-api-key': apiKey },
      payload: { nodeId: 'gc', decision: 'approve', supplement: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'E3014' });
  });
});
