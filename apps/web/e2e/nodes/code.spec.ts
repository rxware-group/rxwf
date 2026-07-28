import { test, expect } from '@playwright/test';

/** E2E-N-code — code 沙箱执行与面板 (M-3 / lite) */

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
      logs?: Array<{ level: string; message: string }>;
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

async function debugCodeNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  codeNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: codeNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('code node E2E-N-code', () => {
  test('Code panel renders JavaScript editor', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Code panel UI E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'c1',
          type: 'code',
          name: 'Code',
          position: { x: 220, y: 0 },
          parameters: {
            jsCode: 'return [{ json: { ok: true } }];',
          },
        },
      ],
      connections: [{ from: 't1', to: 'c1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Code$/ })
      .dblclick();

    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.locator('.code-js-form-field')).toBeVisible();
    await expect(page.locator('.code-js-form-field .cm-editor')).toBeVisible();
    await expect(page.locator('.code-js-form-field')).toContainText('JavaScript');
  });

  test('debug-node executes jsCode and returns computed items', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Code sandbox execution E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'c1',
          type: 'code',
          name: 'Code',
          position: { x: 220, y: 0 },
          parameters: {
            jsCode:
              'return [{ json: { sum: $input[0].json.a + $input[0].json.b } }];',
          },
        },
      ],
      connections: [{ from: 't1', to: 'c1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugCodeNode(request, workflowId, definition, 'c1', {
      t1: [{ json: { a: 2, b: 3 } }],
    });

    expect(result.status).toBe('success');
    const codeOut = result.nodeResults?.c1;
    expect(codeOut?.status).toBe('success');
    expect(codeOut?.outputItems?.[0]?.[0]?.json).toEqual({ sum: 5 });
  });

  test('debug-node collects $log output from jsCode', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Code log collection E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'c1',
          type: 'code',
          name: 'Code',
          position: { x: 220, y: 0 },
          parameters: {
            jsCode: '$log.info("e2e-code"); return [{ json: { ok: true } }];',
          },
        },
      ],
      connections: [{ from: 't1', to: 'c1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugCodeNode(request, workflowId, definition, 'c1', {
      t1: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    const logs = result.nodeResults?.c1?.logs ?? [];
    expect(logs.some((entry) => entry.message === 'e2e-code' && entry.level === 'info')).toBe(
      true,
    );
  });
});
