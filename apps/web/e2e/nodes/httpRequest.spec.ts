import { test, expect } from '@playwright/test';

/** E2E-N-httpRequest — httpRequest 执行与面板 (M-3 / lite) */

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
    data: { name: definition.name, definition },
  });
  if (!res.ok()) {
    throw new Error(`createWorkflow failed: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugHttpNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  nodeId: string,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: nodeId,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

function httpWorkflowDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: `HTTP Request E2E ${Date.now()}`,
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'http1',
        type: 'httpRequest',
        name: 'HTTP',
        position: { x: 220, y: 0 },
        parameters: {
          url: 'https://httpbin.org/get',
          method: 'GET',
          sendHeaders: false,
          sendQuery: false,
          sendBody: false,
        },
      },
    ],
    connections: [{ from: 't1', to: 'http1' }],
  };
}

test.describe('httpRequest E2E-N-httpRequest', () => {
  test('panel fields and debug-node GET execution against httpbin', async ({
    page,
    request,
  }) => {
    const definition = httpWorkflowDefinition();
    const workflowId = await createWorkflow(request, definition);

    await page.goto(`/workflows/${workflowId}`);
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^HTTP$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('方法', { exact: true })).toBeVisible();
    await expect(modal.getByText('URL', { exact: true })).toBeVisible();
    await expect(modal.locator('textarea.param-template-field')).toHaveValue(
      'https://httpbin.org/get',
    );
    await expect(modal.locator('.http-param-fields')).toBeVisible();
    await expect(modal.getByRole('switch', { name: 'Headers' })).toBeVisible();
    await expect(modal.getByRole('switch', { name: 'Query 参数' })).toBeVisible();
    await expect(modal.getByRole('switch', { name: 'Body' })).toBeVisible();

    const result = await debugHttpNode(request, workflowId, definition, 'http1');
    expect(result.status).toBe('success');
    const httpResult = result.nodeResults?.http1;
    expect(httpResult?.status).toBe('success');
    const item = httpResult?.outputItems?.[0]?.[0]?.json;
    expect(item?.ok).toBe(true);
    expect(item?.statusCode).toBe(200);
    expect(item?.requestUrl).toBe('https://httpbin.org/get');
    expect(item?.body).toMatchObject({
      url: 'https://httpbin.org/get',
    });
  });
});
