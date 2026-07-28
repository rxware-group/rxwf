import { test, expect } from '@playwright/test';

/** E2E-N-merge — merge 多分支合并与面板 (M-3 / lite) */

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
  connections: Array<{
    from: string;
    to: string;
    fromOutput?: string;
    outputIndex?: number;
  }>;
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

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const res = await request.post('/api/workflows', {
    data: { name: definition.name, definition },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugMergeNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  mergeNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: mergeNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('merge node E2E-N-merge', () => {
  test('Merge panel shows mode and inputCount fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Merge panel UI E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'm1',
          type: 'merge',
          name: 'Merge',
          position: { x: 220, y: 0 },
          parameters: { mode: 'append', inputCount: 2 },
        },
      ],
      connections: [{ from: 't1', to: 'm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Merge$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.getByText('合并模式')).toBeVisible();
    await expect(page.getByText('输入数量')).toBeVisible();
  });

  test('append mode concatenates items from two upstream branches', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Merge append E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 's0',
          type: 'set',
          name: 'Set A',
          position: { x: 200, y: -40 },
          parameters: { mode: 'manual', fields: { branch: 'A' } },
        },
        {
          id: 's1',
          type: 'set',
          name: 'Set B',
          position: { x: 200, y: 40 },
          parameters: { mode: 'manual', fields: { branch: 'B' } },
        },
        {
          id: 'm1',
          type: 'merge',
          name: 'Merge',
          position: { x: 420, y: 0 },
          parameters: { mode: 'append', inputCount: 2 },
        },
      ],
      connections: [
        { from: 't1', to: 's0' },
        { from: 't1', to: 's1' },
        { from: 's0', to: 'm1' },
        { from: 's1', to: 'm1' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugMergeNode(request, workflowId, definition, 'm1', {
      t1: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    const merged = result.nodeResults?.m1?.outputItems?.[0];
    expect(merged).toEqual([
      { json: { branch: 'A' } },
      { json: { branch: 'B' } },
    ]);
  });

  test('combineByKey merges items with same matchField', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Merge combineByKey E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 's0',
          type: 'set',
          name: 'Set left',
          position: { x: 200, y: -40 },
          parameters: {
            mode: 'manual',
            fields: { id: 'x', left: 1 },
          },
        },
        {
          id: 's1',
          type: 'set',
          name: 'Set right',
          position: { x: 200, y: 40 },
          parameters: {
            mode: 'manual',
            fields: { id: 'x', right: 2 },
          },
        },
        {
          id: 'm1',
          type: 'merge',
          name: 'Merge',
          position: { x: 420, y: 0 },
          parameters: { mode: 'combineByKey', matchField: 'id', inputCount: 2 },
        },
      ],
      connections: [
        { from: 't1', to: 's0' },
        { from: 't1', to: 's1' },
        { from: 's0', to: 'm1' },
        { from: 's1', to: 'm1' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugMergeNode(request, workflowId, definition, 'm1', {
      t1: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    const merged = result.nodeResults?.m1?.outputItems?.[0];
    expect(merged).toEqual([{ json: { id: 'x', left: 1, right: 2 } }]);
  });
});
