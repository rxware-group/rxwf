import { test, expect, type Page } from '@playwright/test';

/** E2E-N-scheduleTrigger — scheduleTrigger 执行与面板 (M-3 / standard) @any */

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
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugScheduleTriggerNode(
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

function scheduleTriggerDefinition(cron = '0 10 * * *'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Schedule Trigger E2E',
    nodes: [
      {
        id: 'st1',
        type: 'scheduleTrigger',
        name: 'Schedule',
        position: { x: 0, y: 0 },
        parameters: { cron },
      },
    ],
    connections: [],
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

test.describe('scheduleTrigger E2E-N-scheduleTrigger @any', () => {
  test('panel shows Cron field and debug-node emits cron output', async ({ page }) => {
    await openNewWorkflowEditor(page);
    await addPaletteNode(page, 'Schedule');

    const node = page
      .locator('.react-flow__node')
      .filter({ has: page.locator('.workflow-node-caption-title', { hasText: /^Schedule$/ }) });
    await node.dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('Cron', { exact: true })).toBeVisible();
    await expect(modal.getByLabel('Cron', { exact: true })).toHaveValue('0 * * * *');

    const cron = '0 10 * * *';
    const definition = scheduleTriggerDefinition(cron);
    const workflowId = await createWorkflow(page.request, definition);
    const result = await debugScheduleTriggerNode(page.request, workflowId, definition, 'st1');

    expect(result.status).toBe('success');
    const triggerResult = result.nodeResults?.st1;
    expect(triggerResult?.status).toBe('success');
    expect(triggerResult?.outputItems?.[0]?.[0]?.json).toMatchObject({ cron });
  });
});
