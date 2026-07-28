import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-executeWorkflow — executeWorkflow 面板与子流执行 (M-3 / standard @any) */

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/executeWorkflow.md');
const SPEC_FILE = 'nodes/executeWorkflow.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  active?: boolean;
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
      errorCode?: string;
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
  const res = await request.post('/api/workflows', {
    data: { name: definition.name, definition },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createWorkflow failed (${res.status()}): ${body}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function publishWorkflow(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
) {
  const res = await request.post(`/api/workflows/${workflowId}/publish`, { data: {} });
  expect(res.ok()).toBeTruthy();
}

async function debugExecuteWorkflowNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  targetNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('executeWorkflow audit row @any', () => {
  test('AUDIT-N-executeWorkflow row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('executeWorkflow E2E-N-executeWorkflow @any', () => {
  test('node editor shows workflowId parameter field', async ({ page }) => {
    const request = page.request;
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `ExecuteWorkflow panel E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sw1',
          type: 'executeWorkflow',
          name: 'Sub',
          position: { x: 220, y: 0 },
          parameters: { workflowId: 'wf-placeholder', inputMapping: {} },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Sub$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('子工作流 ID', { exact: true })).toBeVisible();
    await expect(modal.locator('.subworkflow-input-mapping')).toBeVisible();
  });

  test('debug-node runs published child workflow and returns child output', async ({
    page,
  }) => {
    const request = page.request;
    const childDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `ExecuteWorkflow child E2E ${runId}`,
      active: true,
      nodes: [
        {
          id: 'st1',
          type: 'subworkflowTrigger',
          name: 'Sub Trigger',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll', inputs: [], jsonExample: {} },
        },
        {
          id: 's1',
          type: 'set',
          name: 'Mark',
          position: { x: 220, y: 0 },
          parameters: { fields: { child: true, source: 'e2e' } },
        },
      ],
      connections: [{ from: 'st1', to: 's1' }],
    };

    const childId = await createWorkflow(request, childDefinition);
    await publishWorkflow(request, childId);

    const parentDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `ExecuteWorkflow parent E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sw1',
          type: 'executeWorkflow',
          name: 'Sub',
          position: { x: 220, y: 0 },
          parameters: { workflowId: childId },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const parentId = await createWorkflow(request, parentDefinition);
    const result = await debugExecuteWorkflowNode(request, parentId, parentDefinition, 'sw1', {
      t1: [{ json: { seed: 1 } }],
    });

    const sw1 = result.nodeResults?.sw1;
    if (!sw1 || sw1.status !== 'success') {
      throw new Error(`executeWorkflow debug failed: ${JSON.stringify(result, null, 2)}`);
    }
    expect(sw1.outputItems?.[0]?.[0]?.json).toMatchObject({
      child: true,
      source: 'e2e',
    });
  });

  test('debug-node fails when workflowId is missing', async ({ page }) => {
    const request = page.request;
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `ExecuteWorkflow missing id E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'sw1',
          type: 'executeWorkflow',
          name: 'Sub',
          position: { x: 220, y: 0 },
          parameters: { workflowId: '' },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugExecuteWorkflowNode(request, workflowId, definition, 'sw1', {
      t1: [{ json: {} }],
    });

    expect(result.nodeResults?.sw1?.status).toBe('failed');
    expect(result.nodeResults?.sw1?.errorCode).toBe('E2003');
  });
});
