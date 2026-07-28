import { test, expect } from '@playwright/test';

/** E2E-N-webhookTrigger — webhookTrigger 面板与 HTTP 触发执行 (M-3 / standard) */

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

test.describe('webhookTrigger E2E-N-webhookTrigger @any', () => {
  test('panel renders path/auth URLs and test webhook executes trigger node', async ({
    page,
    request,
  }) => {
    const hookPath = `e2e-${Date.now()}`;
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Webhook Trigger E2E',
      nodes: [
        {
          id: 'wh1',
          type: 'webhookTrigger',
          name: 'Webhook',
          position: { x: 0, y: 0 },
          parameters: { path: hookPath, authMode: 'none' },
        },
      ],
      connections: [],
    };

    const createRes = await request.post('/api/workflows', {
      data: { name: definition.name, definition },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: workflowId } = (await createRes.json()) as { id: string };

    await page.goto(`/workflows/${workflowId}`);
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();

    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Webhook$/ })
      .dblclick();
    await expect(page.locator('.node-editor-modal')).toBeVisible();

    const panel = page.locator('.webhook-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Path', { exact: true })).toHaveValue(hookPath);
    const testUrlBlock = panel.locator('.webhook-url-block').first();
    await expect(testUrlBlock.locator('code.mono')).toContainText(
      `/webhook-test/${workflowId}/${hookPath}`,
    );

    const webhookRes = await request.post(`/webhook-test/${workflowId}/${hookPath}`, {
      data: { orderId: 'e2e-42' },
    });
    expect(webhookRes.status()).toBe(202);
    const body = (await webhookRes.json()) as { executionId: string; status: string };
    expect(body.executionId).toBeTruthy();
    expect(body.status).toBe('success');
  });
});
