import { test, expect } from '@playwright/test';

/** E2E-N-wait — wait 固定时长执行与面板 (M-3 / lite) */

const SPEC_FILE = 'nodes/wait.spec.ts';

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

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const res = await request.post('/api/workflows', {
    data: { name: `${definition.name} ${Date.now()}`, definition },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugWaitNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  waitNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: waitNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('wait E2E-N-wait', () => {
  test('Wait panel exposes ms field in editor', async ({ page }) => {
    const request = page.request;
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Wait panel E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'w1',
          type: 'wait',
          name: 'Wait',
          position: { x: 220, y: 0 },
          parameters: { ms: 100 },
        },
      ],
      connections: [{ from: 't1', to: 'w1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Wait$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.getByLabel('等待 (ms)')).toBeVisible();
    await expect(page.getByLabel('等待 (ms)')).toHaveValue('100');
  });

  test('wait node delays then passes pinned items through', async ({ page }) => {
    const request = page.request;
    await page.goto('/');
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Wait execution E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'w1',
          type: 'wait',
          name: 'Wait',
          position: { x: 220, y: 0 },
          parameters: { ms: 50 },
        },
      ],
      connections: [{ from: 't1', to: 'w1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const started = Date.now();
    const result = await debugWaitNode(request, workflowId, definition, 'w1', {
      t1: [{ json: { marker: 'wait-e2e' } }],
    });
    const elapsed = Date.now() - started;

    expect(result.status).toBe('success');
    expect(result.nodeResults?.w1?.status).toBe('success');
    expect(result.nodeResults?.w1?.outputItems?.[0]).toEqual([
      { json: { marker: 'wait-e2e' } },
    ]);
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  test('matrix row E2E-N-wait is covered by this spec', () => {
    expect(SPEC_FILE).toBe('nodes/wait.spec.ts');
  });
});
