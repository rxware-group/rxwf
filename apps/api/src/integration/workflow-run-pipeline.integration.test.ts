/**
 * workflow_run：经统一 enqueue 执行编译子图（AC-S3 子集，mock LLM）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
  type LiteDatabase,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createUserService } from '@rxwf/identity';
import {
  createExecutionRuntime,
  definitionFromSnapshot,
} from '../execution/create-execution-runtime.js';

const executionsTable = liteSchema.executions;
const nodeRunsTable = liteSchema.nodeRuns;

function setupRxwfWorkspace(root: string): void {
  const wfDir = join(root, '.rxwf', 'workflows');
  const skillDir = join(root, '.rxwf', 'skills', 'hello');
  mkdirSync(wfDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(wfDir, 'mini.workflow.yaml'),
    `id: mini
name: Mini Pipeline
steps:
  - id: s1
    skillRef: hello
    promptTemplate: "run"
`,
  );
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    '---\nname: hello\npermissions:\n  - filesystem:read\n---\n\nRun hello skill.\n',
  );
  writeFileSync(
    join(root, '.rxwf', 'rxwf.project.json'),
    JSON.stringify({ workflows: { enabled: true } }),
  );
}

describe('workflow_run pipeline (lite)', () => {
  let db: LiteDatabase;
  let runtime: Awaited<ReturnType<typeof createExecutionRuntime>>;
  let workflowId: string;
  let workspaceRoot: string;

  beforeAll(async () => {
    db = await createTestDb();
    workspaceRoot = mkdtempSync(join(tmpdir(), 'rxwf-wfr-pipe-'));
    setupRxwfWorkspace(workspaceRoot);

    const ai = {
      async *chat() {
        yield 'ok';
      },
      async runAgent() {
        return { items: [{ json: { answer: 'skill-ok' } }] };
      },
      async runGroupChat() {
        throw new Error('not used');
      },
    } as unknown as AiRuntime;

    runtime = await createExecutionRuntime(
      db,
      { os: 'linux', arch: 'x64' },
      { featurePlus: true, ai },
    );

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const publishUserId = (
      await createUserService(db).createUser({
        email: `wfr-pipe-${crypto.randomUUID()}@example.com`,
        password: 'secret1234',
        role: 'admin',
      })
    ).id;

    const created = await workflows.create({
      name: 'Parent workflow_run',
      definition: {
        schemaVersion: 1,
        name: 'Parent workflow_run',
        active: true,
        settings: { skillToolIntentAuto: true },
        nodes: [
          {
            id: 'tr',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'wfr',
            type: 'workflow_run',
            name: 'Run template',
            position: { x: 220, y: 0 },
            parameters: {
              workflowSource: 'template',
              workflowRelPath: 'mini',
              workspaceRoot,
              expandTemplate: 'true',
            },
          },
        ],
        connections: [{ from: 'tr', to: 'wfr' }],
      },
    });
    workflowId = created.id;
    await workflows.publish(workflowId, publishUserId);
  });

  it('enqueues parent and runs compiled child via runCompiledWorkflow', async () => {
    const enqueued = await runtime.enqueueService.enqueue({
      workflowId,
      triggerType: 'manual',
      mode: 'manual',
    });
    const stored = await runtime.executionRepo.getExecution(enqueued.executionId);
    expect(stored).toBeTruthy();

    const definition = definitionFromSnapshot(stored!.definitionSnapshot);
    const result = await runtime.runner.runStoredExecution({
      executionId: enqueued.executionId,
      definition,
      mode: 'manual',
      subworkflowDepth: 0,
      parentExecutionId: enqueued.executionId,
    });

    expect(result.status).toBe('success');
    const out = result.finalOutputItems?.[0]?.json as Record<string, unknown> | undefined;
    expect(out?.childExecutionId).toBeTruthy();

    const allExecs = await db.select().from(executionsTable);
    expect(allExecs.length).toBeGreaterThanOrEqual(2);

    const nodeRuns = await db.select().from(nodeRunsTable);
    const types = nodeRuns.map((r) => r.nodeType);
    expect(types).toContain('workflow_run');
    expect(types.some((t) => t === 'skillRun')).toBe(true);

    const childExec = allExecs.find((e) => e.id !== enqueued.executionId);
    expect(childExec).toBeTruthy();
    const childStored = await runtime.executionRepo.getExecution(childExec!.id);
    const childDef = definitionFromSnapshot(childStored!.definitionSnapshot);
    const skillNode = childDef.nodes.find((n) => n.type === 'skillRun');
    expect(skillNode?.parameters?.workspaceRoot).toBe(workspaceRoot);

    const skillRunRow = nodeRuns.find((r) => r.nodeType === 'skillRun');
    expect(skillRunRow?.status).toBe('success');
  });
});
