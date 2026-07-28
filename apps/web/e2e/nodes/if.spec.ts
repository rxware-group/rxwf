import { test, expect } from '@playwright/test';

/** E2E-N-if — IF 条件分流执行与面板 (M-3 / lite / AUDIT-N-if) */

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

async function debugIfNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  ifNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: ifNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('if node E2E-N-if', () => {
  test('node editor shows condition parameter field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'IF panel UI E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'if1',
          type: 'if',
          name: 'IF',
          position: { x: 220, y: 0 },
          parameters: { condition: '{{ $json.active === true }}' },
        },
      ],
      connections: [{ from: 't1', to: 'if1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^IF$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.getByText('条件')).toBeVisible();
    await expect(page.locator('.if-condition-form-field')).toBeVisible();
  });

  test('routes matching items to true output and others to false', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'IF routing E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'if1',
          type: 'if',
          name: 'IF',
          position: { x: 220, y: 0 },
          parameters: { condition: '{{ $json.active === true }}' },
        },
      ],
      connections: [{ from: 't1', to: 'if1' }],
    };

    const workflowId = await createWorkflow(request, definition);

    const result = await debugIfNode(request, workflowId, definition, 'if1', {
      t1: [
        { json: { active: true, id: 1 } },
        { json: { active: false, id: 2 } },
        { json: { active: true, id: 3 } },
      ],
    });

    expect(result.status).toBe('success');
    const ifOut = result.nodeResults?.if1?.outputItems;
    expect(ifOut).toBeTruthy();
    expect(ifOut![0]).toEqual([
      { json: { active: true, id: 1 } },
      { json: { active: true, id: 3 } },
    ]);
    expect(ifOut![1]).toEqual([{ json: { active: false, id: 2 } }]);
  });

  test('fails debug run when condition expression is empty', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'IF empty condition E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'if1',
          type: 'if',
          name: 'IF',
          position: { x: 220, y: 0 },
          parameters: { condition: '' },
        },
      ],
      connections: [{ from: 't1', to: 'if1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugIfNode(request, workflowId, definition, 'if1', {
      t1: [{ json: { active: true } }],
    });

    expect(result.nodeResults?.if1?.status).toBe('failed');
    expect(result.nodeResults?.if1?.errorCode).toBe('E2003');
  });
});
