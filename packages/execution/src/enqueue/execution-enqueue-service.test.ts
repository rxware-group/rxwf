import { describe, it, expect, beforeEach } from 'vitest';
import { AwfError } from '@rxwf/shared';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { createExecutionEnqueueService } from './execution-enqueue-service.js';

const baseDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'Demo',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'Start',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'n1',
      type: 'set',
      name: 'Set',
      position: { x: 1, y: 0 },
      parameters: { fields: { x: 1 } },
    },
  ],
  connections: [{ from: 't1', to: 'n1' }],
};

type StoredVersion = {
  id: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
};

function createMemoryEnqueueDeps() {
  const versions = new Map<string, StoredVersion[]>();
  const workflows = new Map<string, { status: string; publishedVersionId?: string }>();
  const executions = new Map<
    string,
    { workflowVersionId: string; definitionSnapshot: string; version: number }
  >();

  return {
    executions,
    deps: {
      async loadWorkflow(workflowId: string, source: 'draft' | 'published' = 'draft') {
        const wf = workflows.get(workflowId);
        const list = versions.get(workflowId);
        if (!wf || !list?.length) return null;
        const latest = list[list.length - 1]!;
        const published =
          wf.publishedVersionId != null
            ? list.find((v) => v.id === wf.publishedVersionId) ?? null
            : null;
        const picked = source === 'published' ? published : latest;
        if (!picked) return null;
        return {
          workflowId,
          status: wf.status,
          workflowVersionId: picked.id,
          version: picked.version,
          definition: picked.definition,
        };
      },
      async insertExecution(record: {
        id: string;
        workflowVersionId: string;
        definitionSnapshot: string;
        version: number;
      }) {
        executions.set(record.id, {
          workflowVersionId: record.workflowVersionId,
          definitionSnapshot: record.definitionSnapshot,
          version: record.version,
        });
      },
    },
    seed(
      workflowId: string,
      status: string,
      vers: StoredVersion[],
      publishedVersionId?: string,
    ) {
      workflows.set(workflowId, {
        status,
        publishedVersionId: publishedVersionId ?? vers[vers.length - 1]?.id,
      });
      versions.set(workflowId, vers);
    },
  };
}

describe('createExecutionEnqueueService', () => {
  let mem: ReturnType<typeof createMemoryEnqueueDeps>;

  beforeEach(() => {
    mem = createMemoryEnqueueDeps();
  });

  it('persists definition_snapshot from published version at enqueue time (AC-42)', async () => {
    const workflowId = 'wf-1';
    const versions = [
      {
        id: 'ver-1',
        workflowId,
        version: 1,
        definition: { ...baseDefinition, name: 'v1' },
      },
      {
        id: 'ver-2',
        workflowId,
        version: 2,
        definition: { ...baseDefinition, name: 'v2' },
      },
      {
        id: 'ver-3',
        workflowId,
        version: 3,
        definition: { ...baseDefinition, name: 'v3' },
      },
    ];
    mem.seed(workflowId, 'published', versions, 'ver-3');

    const svc = createExecutionEnqueueService(mem.deps);
    const first = await svc.enqueue({
      workflowId,
      triggerType: 'manual',
      mode: 'production',
    });

    mem.seed(
      workflowId,
      'published',
      [
        ...versions,
        {
          id: 'ver-4',
          workflowId,
          version: 4,
          definition: { ...baseDefinition, name: 'v4' },
        },
      ],
      'ver-3',
    );

    const snap = mem.executions.get(first.executionId)!;
    expect(snap.version).toBe(3);
    expect(JSON.parse(snap.definitionSnapshot).name).toBe('v3');

    const second = await svc.enqueue({
      workflowId,
      triggerType: 'manual',
      mode: 'production',
    });
    const snap2 = mem.executions.get(second.executionId)!;
    expect(snap2.version).toBe(3);
  });

  it('rejects enqueue when workflow is unpublished in production mode', async () => {
    const workflowId = 'wf-inactive';
    mem.seed(workflowId, 'draft', [
      {
        id: 'ver-1',
        workflowId,
        version: 1,
        definition: baseDefinition,
      },
    ]);
    const svc = createExecutionEnqueueService(mem.deps);
    await expect(
      svc.enqueue({ workflowId, triggerType: 'webhook', mode: 'production' }),
    ).rejects.toMatchObject({ code: 'E2001' });
  });
});
