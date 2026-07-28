/**
 * Optional real Ollama smoke for AI Agent node.
 * Run with: RXWF_TEST_OLLAMA=1 pnpm --filter @rxwf/api test -- p4b-agent-ollama
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteAgentMemoryRepository,
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createExecutionRuntime } from '../execution/create-execution-runtime.js';

const jobsTable = liteSchema.jobs;
const nodeRunsTable = liteSchema.nodeRuns;

const runOllama = process.env.RXWF_TEST_OLLAMA === '1';

describe.skipIf(!runOllama)('P4-B agent ollama e2e (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      {
        featurePlus: true,
        ollamaUrl: process.env.RXWF_OLLAMA_URL ?? 'http://127.0.0.1:11434',
        ollamaModel: process.env.RXWF_OLLAMA_MODEL ?? 'llama3',
        agentMemory: createLiteAgentMemoryRepository(db),
      },
    );

    const created = await workflows.create({
      name: 'P4B Ollama Agent',
      definition: {
        schemaVersion: 1,
        name: 'Ollama Agent',
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
            parameters: { sessionId: 'ollama-smoke' },
          },
          {
            id: 'mdl',
            type: 'aiChatModel',
            name: 'Model',
            position: { x: 0, y: 80 },
            parameters: { provider: 'ollama', model: process.env.RXWF_OLLAMA_MODEL ?? 'llama3' },
          },
          {
            id: 'tool',
            type: 'toolMcp',
            name: 'Echo',
            position: { x: 200, y: 80 },
            parameters: {
              serverId: 'srv-smoke',
              tools: ['echo'],
              toolDescription: 'Echo input (unused in zero-tool-turn smoke)',
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
      },
    });
    workflowId = created.id;
    await workflows.publish(workflowId, publishUserId);
  }, 60_000);

  it(
    'completes agent run without tools using real Ollama',
    async () => {
      await db.insert(jobsTable).values({
        id: crypto.randomUUID(),
        kind: 'execution.enqueue',
        payload: JSON.stringify({
          workflowId,
          triggerType: 'manual',
          sessionId: 'ollama-smoke',
        }),
        status: 'pending',
        createdAt: new Date(),
      });
      await runtime.jobProcessor.processOnce();

      const runs = await db
        .select()
        .from(nodeRunsTable)
        .where(eq(nodeRunsTable.nodeId, 'agt'));
      const last = runs.at(-1);
      expect(last?.status).toBe('success');
      const output = last?.outputData ? JSON.parse(last.outputData) : null;
      const answer = output?.[0]?.[0]?.json?.answer;
      expect(typeof answer).toBe('string');
      expect(String(answer).length).toBeGreaterThan(0);
    },
    60_000,
  );
});
