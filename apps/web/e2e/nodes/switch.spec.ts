import { test, expect } from '@playwright/test';

/** E2E-N-switch — switch 动态分支执行与面板 (M-3 lite / AUDIT-N-switch) */

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
    }
  >;
};

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const res = await request.post('/api/workflows', {
    data: { name: `${definition.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, definition },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugSwitchNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  switchNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: switchNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('switch node E2E-N-switch', () => {
  test.describe.configure({ mode: 'serial' });
  test('SwitchBranchesPanel supports dynamic branch rules in editor', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Switch panel UI E2E',
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
          type: 'switch',
          name: 'Switch',
          position: { x: 220, y: 0 },
          parameters: {
            branches: [{ id: 'branch-ui-a', label: '端口1', condition: '{{ true }}' }],
          },
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
      .filter({ hasText: /^Switch$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.locator('.switch-branches-panel')).toBeVisible();
    await expect(page.getByText('添加分支')).toBeVisible();

    await page.locator('.switch-branch-add').click();
    await expect(page.locator('.switch-branch-row')).toHaveCount(2);
  });

  test('multi-branch switch routes each item to the first matching branch only', async ({
    request,
  }) => {
    const branchA = 'e2e-branch-a';
    const branchB = 'e2e-branch-b';
    const branchC = 'e2e-branch-c';

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Switch multi-branch routing E2E',
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
          type: 'switch',
          name: 'Switch',
          position: { x: 220, y: 0 },
          parameters: {
            branches: [
              { id: branchA, label: 'Route A', condition: '{{ $json.route === "a" }}' },
              { id: branchB, label: 'Route B', condition: '{{ $json.route === "b" }}' },
              { id: branchC, label: 'Catch-all', condition: '{{ true }}' },
            ],
          },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const workflowId = await createWorkflow(request, definition);

    const result = await debugSwitchNode(request, workflowId, definition, 'sw1', {
      t1: [
        { json: { route: 'a' } },
        { json: { route: 'b' } },
        { json: { route: 'other' } },
      ],
    });

    expect(result.status).toBe('success');
    const switchOut = result.nodeResults?.sw1?.outputItems;
    expect(switchOut).toBeTruthy();
    expect(switchOut![0]).toEqual([{ json: { route: 'a' } }]);
    expect(switchOut![1]).toEqual([{ json: { route: 'b' } }]);
    expect(switchOut![2]).toEqual([{ json: { route: 'other' } }]);
  });

  test('when multiple branches match, only the first true branch receives the item', async ({
    request,
  }) => {
    const branchA = 'e2e-first-match-a';
    const branchB = 'e2e-first-match-b';
    const branchC = 'e2e-first-match-c';

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Switch first-match E2E',
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
          type: 'switch',
          name: 'Switch',
          position: { x: 220, y: 0 },
          parameters: {
            branches: [
              { id: branchA, label: 'First', condition: '{{ $json.n > 0 }}' },
              { id: branchB, label: 'Second', condition: '{{ true }}' },
              { id: branchC, label: 'Third', condition: '{{ true }}' },
            ],
          },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const workflowId = await createWorkflow(request, definition);

    const result = await debugSwitchNode(request, workflowId, definition, 'sw1', {
      t1: [{ json: { n: 5 } }],
    });

    expect(result.status).toBe('success');
    const switchOut = result.nodeResults?.sw1?.outputItems;
    expect(switchOut).toBeTruthy();
    expect(switchOut![0]).toEqual([{ json: { n: 5 } }]);
    expect(switchOut![1]).toEqual([]);
    expect(switchOut![2]).toEqual([]);
  });

  test('fails debug run when branches array is empty', async ({ request }) => {
    const validDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Switch empty branches E2E',
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
          type: 'switch',
          name: 'Switch',
          position: { x: 220, y: 0 },
          parameters: {
            branches: [{ id: 'valid-branch', label: 'A', condition: '{{ true }}' }],
          },
        },
      ],
      connections: [{ from: 't1', to: 'sw1' }],
    };

    const workflowId = await createWorkflow(request, validDefinition);

    const invalidDefinition: WorkflowDefinition = {
      ...validDefinition,
      nodes: validDefinition.nodes.map((node) =>
        node.id === 'sw1'
          ? { ...node, parameters: { branches: [] } }
          : node,
      ),
    };

    const result = await debugSwitchNode(request, workflowId, invalidDefinition, 'sw1', {
      t1: [{ json: {} }],
    });

    expect(result.nodeResults?.sw1?.status).toBe('failed');
  });
});
