import { test, expect, type Page } from '@playwright/test';

/** E2E-N-errorTrigger — errorTrigger 执行与面板 (M-3 / standard) @any */

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

const SAMPLE_PAYLOAD = {
  executionId: 'ex-e2e-1',
  workflowId: 'wf-e2e-1',
  failedNode: 'HTTP Request',
  errorMessage: 'E2E boom',
  stack: 'Error: E2E boom',
  timestamp: '2026-05-20T00:00:00.000Z',
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

async function debugErrorTriggerNode(
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

function errorTriggerDefinition(name = 'Error Trigger E2E'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
    nodes: [
      {
        id: 'et1',
        type: 'errorTrigger',
        name: 'Error Trigger',
        position: { x: 0, y: 0 },
        parameters: { _debugSamplePayload: SAMPLE_PAYLOAD },
      },
      {
        id: 'set1',
        type: 'set',
        name: 'Set',
        position: { x: 240, y: 0 },
        parameters: { mode: 'manual', fields: { echoed: '{{ $json.errorMessage }}' } },
      },
    ],
    connections: [{ from: 'et1', to: 'set1' }],
  };
}

async function openNewWorkflowEditor(page: Page) {
  await page.goto('/workflows/new');
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.editor-palette-pane input[type="search"]')).toBeVisible();
}

async function addPaletteNode(page: Page, label: string) {
  const palette = page.locator('.editor-palette-pane');
  const search = palette.locator('input[type="search"]');
  await search.fill(label);
  const button = palette.getByRole('button', { name: label });
  await expect(button).toBeVisible();
  await button.click();
  await search.fill('');
}

test.describe('errorTrigger E2E-N-errorTrigger @any', () => {
  test('Error Trigger panel shows debug sample payload field', async ({ page }) => {
    await openNewWorkflowEditor(page);
    await addPaletteNode(page, 'Error Trigger');

    const node = page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.workflow-node-caption-title', { hasText: /^Error Trigger$/ }) });
    await node.dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('调试样例载荷 (JSON)', { exact: true })).toBeVisible();
    await expect(modal.locator('.cm-content')).toContainText('executionId');
  });

  test('debug-node executes errorTrigger with sample payload output', async ({ request }) => {
    const definition = errorTriggerDefinition(`Error Trigger E2E ${Date.now()}`);
    const workflowId = await createWorkflow(request, definition);
    const result = await debugErrorTriggerNode(request, workflowId, definition, 'et1');

    expect(result.status).toBe('success');
    const triggerResult = result.nodeResults?.et1;
    expect(triggerResult?.status).toBe('success');
    expect(triggerResult?.outputItems?.[0]?.[0]?.json).toMatchObject({
      executionId: 'ex-e2e-1',
      failedNode: 'HTTP Request',
      errorMessage: 'E2E boom',
    });
  });
});
