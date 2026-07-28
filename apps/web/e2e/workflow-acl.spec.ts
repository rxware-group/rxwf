import { test, expect, type Page } from '@playwright/test';

/** 追溯 AC: AC-018 / E2E-P-018 工作流 ACL 协作者权限 */

const VIEWER_PASSWORD = 'e2e-viewer-pass';

const baseDefinition = {
  schemaVersion: 1 as const,
  name: 'ACL E2E Workflow',
  nodes: [
    {
      id: 't1',
      type: 'manualTrigger',
      name: 'Start',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

async function login(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
}

async function createViewerViaAdmin(page: Page, email: string) {
  const res = await page.request.post('/api/admin/users', {
    data: { email, password: VIEWER_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { user: { id: string } };
  return body.user.id;
}

async function createSharedWorkflow(page: Page, viewerUserId: string) {
  const createRes = await page.request.post('/api/workflows', {
    data: {
      name: `ACL E2E ${Date.now()}`,
      definition: baseDefinition,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id: workflowId } = (await createRes.json()) as { id: string };

  const shareRes = await page.request.put(
    `/api/workflows/${encodeURIComponent(workflowId)}/collaborators`,
    {
      data: {
        collaborators: [{ userId: viewerUserId, role: 'viewer' }],
      },
    },
  );
  expect(shareRes.ok()).toBeTruthy();
  return workflowId;
}

async function openWorkflowSettings(page: Page) {
  await page.locator('.editor-toolbar-more-btn').click();
  await page.locator('.workflow-node-menu').getByRole('menuitem').first().click();
}

test.describe('workflow ACL @standard @any', () => {
  test('viewer edit attempt is blocked (save rejected, definition unchanged)', async ({
    browser,
    page,
  }) => {
    const viewerEmail = `viewer-${crypto.randomUUID()}@e2e.test.local`;
    const viewerUserId = await createViewerViaAdmin(page, viewerEmail);
    const workflowId = await createSharedWorkflow(page, viewerUserId);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, viewerEmail, VIEWER_PASSWORD);
    await viewerPage.goto(`/workflows/${workflowId}`);

    await expect(viewerPage.locator('.react-flow')).toBeVisible();
    await expect(viewerPage.locator('.react-flow__node')).toHaveCount(1);

    const palette = viewerPage.locator('.editor-palette-pane');
    await palette.getByRole('button', { name: 'Manual' }).click();

    await expect(
      viewerPage.locator('.error, .dirty-badge.is-error').filter({ hasText: '无权修改' }),
    ).toBeVisible({ timeout: 10_000 });

    const ownerGetRes = await page.request.get(
      `/api/workflows/${encodeURIComponent(workflowId)}`,
    );
    expect(ownerGetRes.ok()).toBeTruthy();
    const ownerBody = (await ownerGetRes.json()) as {
      workflow: { definition: { nodes: unknown[] } };
    };
    expect(ownerBody.workflow.definition.nodes).toHaveLength(1);

    await viewerContext.close();
  });

  test('viewer cannot update collaborators (API 403)', async ({ browser, page }) => {
    const viewerEmail = `viewer-${crypto.randomUUID()}@e2e.test.local`;
    const viewerUserId = await createViewerViaAdmin(page, viewerEmail);
    const workflowId = await createSharedWorkflow(page, viewerUserId);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, viewerEmail, VIEWER_PASSWORD);

    const putRes = await viewerPage.request.put(
      `/api/workflows/${encodeURIComponent(workflowId)}/collaborators`,
      {
        data: {
          collaborators: [{ userId: viewerUserId, role: 'editor' }],
        },
      },
    );
    expect(putRes.status()).toBe(403);
    const body = (await putRes.json()) as { code?: string };
    expect(body.code).toBe('E4003');

    await viewerContext.close();
  });

  test('viewer sees read-only collaborators panel', async ({ browser, page }) => {
    const viewerEmail = `viewer-${crypto.randomUUID()}@e2e.test.local`;
    const viewerUserId = await createViewerViaAdmin(page, viewerEmail);
    const workflowId = await createSharedWorkflow(page, viewerUserId);

    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, viewerEmail, VIEWER_PASSWORD);
    await viewerPage.goto(`/workflows/${workflowId}`);
    await expect(viewerPage.locator('.react-flow')).toBeVisible();

    await openWorkflowSettings(viewerPage);
    await viewerPage
      .locator('.workflow-settings-tabs')
      .getByRole('button')
      .filter({ hasText: /协作|Collaborators/i })
      .click();

    await expect(viewerPage.locator('.workflow-collaborators-panel')).toBeVisible();
    await expect(
      viewerPage.getByRole('button', { name: /添加协作者|Add collaborator/i }),
    ).toHaveCount(0);

    await viewerContext.close();
  });
});
