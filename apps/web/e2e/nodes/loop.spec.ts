import { test, expect } from '@playwright/test';

/** E2E-N-loop — loop 批次迭代与面板 (M-3 / lite) */

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
      loopIterationCount?: number;
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

async function debugLoopNode(
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

test.describe('loop node E2E-N-loop', () => {
  test('node editor shows batchSize parameter field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Loop panel E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'loop1',
          type: 'loop',
          name: 'Loop',
          position: { x: 220, y: 0 },
          parameters: { batchSize: 2 },
        },
        {
          id: 'body1',
          type: 'set',
          name: 'Body',
          position: { x: 440, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'loop1' },
        { from: 'loop1', to: 'body1', fromOutput: '0' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Loop$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.getByText('每批 Items 数')).toBeVisible();
  });

  test('loop iterates body per batch and aggregates on done output', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Loop batch iteration E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'loop1',
          type: 'loop',
          name: 'Loop',
          position: { x: 200, y: 0 },
          parameters: { batchSize: 1 },
        },
        {
          id: 'setA',
          type: 'set',
          name: 'Body',
          position: { x: 400, y: 0 },
          parameters: {},
        },
        {
          id: 'setDone',
          type: 'set',
          name: 'Done',
          position: { x: 600, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'loop1' },
        { from: 'loop1', to: 'setA', fromOutput: '0' },
        { from: 'setA', to: 'setDone' },
        { from: 'loop1', to: 'setDone', fromOutput: '1' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);

    const result = await debugLoopNode(request, workflowId, definition, 'loop1', {
      t1: [{ json: { i: 1 } }, { json: { i: 2 } }],
    });

    expect(result.status).toBe('success');
    const loopOut = result.nodeResults?.loop1;
    expect(loopOut?.loopIterationCount).toBe(2);
    expect(loopOut?.outputItems?.[1]).toHaveLength(2);
  });

  test('loop with batchSize 2 runs fewer iterations', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Loop batchSize E2E ${runId}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'loop1',
          type: 'loop',
          name: 'Loop',
          position: { x: 200, y: 0 },
          parameters: { batchSize: 2 },
        },
        {
          id: 'setA',
          type: 'set',
          name: 'Body',
          position: { x: 400, y: 0 },
          parameters: {},
        },
        {
          id: 'setDone',
          type: 'set',
          name: 'Done',
          position: { x: 600, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'loop1' },
        { from: 'loop1', to: 'setA', fromOutput: '0' },
        { from: 'setA', to: 'setDone' },
        { from: 'loop1', to: 'setDone', fromOutput: '1' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);

    const result = await debugLoopNode(request, workflowId, definition, 'loop1', {
      t1: [
        { json: { i: 1 } },
        { json: { i: 2 } },
        { json: { i: 3 } },
      ],
    });

    expect(result.status).toBe('success');
    expect(result.nodeResults?.loop1?.loopIterationCount).toBe(2);
  });
});
