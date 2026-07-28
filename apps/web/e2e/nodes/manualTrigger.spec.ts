import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-manualTrigger — manualTrigger 面板与执行 (M-3 / lite) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/manualTrigger.md');
const SPEC_FILE = 'nodes/manualTrigger.spec.ts';

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

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const uniqueDefinition = {
    ...definition,
    name: `${definition.name} ${Date.now()}`,
  };
  const res = await request.post('/api/workflows', {
    data: { name: uniqueDefinition.name, definition: uniqueDefinition },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return { workflowId: body.id, definition: uniqueDefinition };
}

async function debugManualTrigger(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  triggerNodeId: string,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: triggerNodeId,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('manualTrigger audit row', () => {
  test('AUDIT-N-manualTrigger row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('manualTrigger E2E-N-manualTrigger', () => {
  test('node editor shows JSON parameter field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Manual trigger panel E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: { json: { seed: true } },
        },
      ],
      connections: [],
    };

    const { workflowId } = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Manual$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('JSON', { exact: true })).toBeVisible();
    await expect(modal.locator('.rxwf-param-codemirror')).toBeVisible();
  });

  test('debug-node emits configured json items from manualTrigger', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Manual trigger execute E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: { json: { orderId: 'e2e-42', active: true } },
        },
      ],
      connections: [],
    };

    const { workflowId, definition: savedDefinition } = await createWorkflow(request, definition);
    const result = await debugManualTrigger(request, workflowId, savedDefinition, 't1');

    expect(result.status).toBe('success');
    expect(result.nodeResults?.t1?.status).toBe('success');
    expect(result.nodeResults?.t1?.outputItems?.[0]).toEqual([
      { json: { orderId: 'e2e-42', active: true } },
    ]);
  });

  test('debug-node emits multiple items when json is an array', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Manual trigger array E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: { json: [{ id: 1 }, { id: 2 }] },
        },
      ],
      connections: [],
    };

    const { workflowId, definition: savedDefinition } = await createWorkflow(request, definition);
    const result = await debugManualTrigger(request, workflowId, savedDefinition, 't1');

    expect(result.status).toBe('success');
    expect(result.nodeResults?.t1?.outputItems?.[0]).toEqual([
      { json: { id: 1 } },
      { json: { id: 2 } },
    ]);
  });
});
