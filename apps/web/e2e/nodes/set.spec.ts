import { test, expect } from '@playwright/test';

/** E2E-N-set — set 节点面板与执行 (M-3 / lite) */

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

async function debugSetNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  setNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: setNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('set node E2E-N-set', () => {
  test.describe.configure({ mode: 'serial' });
  test('Set panel exposes mode and fields editors', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Set panel UI E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'set1',
          type: 'set',
          name: 'Set',
          position: { x: 220, y: 0 },
          parameters: { mode: 'manual', fields: { status: 'ready' } },
        },
      ],
      connections: [{ from: 't1', to: 'set1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Set$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.getByText('模式', { exact: true })).toBeVisible();
    await expect(page.getByText('字段', { exact: true })).toBeVisible();
    await expect(page.locator('.json-param-form-field')).toBeVisible();
  });

  test('merges static fields into upstream items via debug-node', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Set merge fields E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'set1',
          type: 'set',
          name: 'Set',
          position: { x: 220, y: 0 },
          parameters: {
            mode: 'manual',
            fields: { status: 'done', count: 3 },
          },
        },
      ],
      connections: [{ from: 't1', to: 'set1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugSetNode(request, workflowId, definition, 'set1', {
      t1: [{ json: { id: 1 } }],
    });

    expect(result.status).toBe('success');
    expect(result.nodeResults?.set1?.outputItems?.[0]?.[0]?.json).toEqual({
      id: 1,
      status: 'done',
      count: 3,
    });
  });

  test('resolves expression mode field templates', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Set expression mode E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'set1',
          type: 'set',
          name: 'Set',
          position: { x: 220, y: 0 },
          parameters: {
            mode: 'expression',
            fields: {
              userId: '{{ $json.id }}',
              tag: 'static',
            },
          },
        },
      ],
      connections: [{ from: 't1', to: 'set1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugSetNode(request, workflowId, definition, 'set1', {
      t1: [{ json: { id: 42 } }],
    });

    expect(result.status).toBe('success');
    expect(result.nodeResults?.set1?.outputItems?.[0]?.[0]?.json).toEqual({
      id: 42,
      userId: '42',
      tag: 'static',
    });
  });
});
