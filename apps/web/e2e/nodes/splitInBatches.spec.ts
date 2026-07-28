import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-splitInBatches — splitInBatches 执行与面板 (M-3 / plus) */

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/splitInBatches.md');
const SPEC_FILE = 'nodes/splitInBatches.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    position: { x: number; y: number };
    parameters: Record<string, unknown>;
  }>;
  connections: Array<{ from: string; to: string }>;
};

type DebugNodeResponse = {
  status: string;
  nodeResults?: Record<
    string,
    {
      status: string;
      outputItems?: Array<Array<{ json: Record<string, unknown> }>>;
    }
  >;
};

function readAuditRowField(field: string): string {
  const content = readFileSync(auditRowPath, 'utf8');
  const match = content.match(
    new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'i'),
  );
  if (!match) {
    throw new Error(`audit row field "${field}" missing from ${auditRowPath}`);
  }
  return match[1]!.trim();
}

function uniqueWorkflowName(base: string): string {
  return `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const name = uniqueWorkflowName(definition.name);
  const res = await request.post('/api/workflows', {
    data: { name, definition: { ...definition, name } },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createWorkflow failed (${res.status()}): ${body}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugSplitInBatchesNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  nodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: nodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('splitInBatches audit row', () => {
  test('AUDIT-N-splitInBatches row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('splitInBatches E2E-N-splitInBatches @any', () => {
  test('Split In Batches panel shows batchSize field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Split In Batches panel E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sib1',
          type: 'splitInBatches',
          name: 'Split',
          position: { x: 240, y: 0 },
          parameters: { batchSize: 2 },
        },
      ],
      connections: [{ from: 't1', to: 'sib1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Split$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '批次大小' })).toBeVisible();
  });
});

test.describe('splitInBatches E2E-N-splitInBatches @any', () => {
  test('debug-node splits items into batch output branches', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Split In Batches execute E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sib1',
          type: 'splitInBatches',
          name: 'Split',
          position: { x: 240, y: 0 },
          parameters: { batchSize: 2 },
        },
      ],
      connections: [{ from: 't1', to: 'sib1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugSplitInBatchesNode(request, workflowId, definition, 'sib1', {
      t1: [
        { json: { i: 1 } },
        { json: { i: 2 } },
        { json: { i: 3 } },
        { json: { i: 4 } },
      ],
    });

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.sib1;
    expect(nodeResult?.status).toBe('success');
    expect(nodeResult?.outputItems).toHaveLength(2);
    expect(nodeResult?.outputItems?.[0]).toHaveLength(2);
    expect(nodeResult?.outputItems?.[0]?.[0]?.json).toEqual({ i: 1 });
    expect(nodeResult?.outputItems?.[1]?.[0]?.json).toEqual({ i: 3 });
  });
});
