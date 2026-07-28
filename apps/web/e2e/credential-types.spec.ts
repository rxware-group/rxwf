import { test, expect } from '@playwright/test';

/** E2E-P-011 — 凭证：创建与引用 (M-2 / standard) */

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

test.describe('credential types E2E-P-011', () => {
  test('registry-driven credentials form creates credential and HTTP node can reference it', async ({
    page,
    request,
  }) => {
    const credName = `E2E Cred ${Date.now()}`;
    const apiKeyValue = `rxwf-e2e-key-${Date.now()}`;

    await page.goto('/settings/credentials');
    const settingsDialog = page.getByRole('dialog', { name: '设置' });
    await expect(settingsDialog.getByRole('heading', { name: '凭证', level: 1 })).toBeVisible();

    const addSection = settingsDialog.locator('.form-grid');
    await addSection.getByRole('textbox', { name: '名称' }).fill(credName);
    await addSection.getByRole('textbox', { name: 'API Key' }).fill(apiKeyValue);
    await settingsDialog.getByRole('button', { name: '创建' }).click();

    await expect(settingsDialog.locator('.data-table')).toContainText(credName);

    const listRes = await request.get('/api/credentials');
    expect(listRes.ok()).toBeTruthy();
    const credentials = (await listRes.json()) as Array<{
      id: string;
      name: string;
      type: string;
    }>;
    const created = credentials.find((c) => c.name === credName);
    expect(created).toBeTruthy();

    const typesRes = await request.get('/api/credentials/types');
    expect(typesRes.ok()).toBeTruthy();
    const typesBody = (await typesRes.json()) as {
      types: Array<{ id: string; displayName: string; fields: unknown[] }>;
    };
    expect(typesBody.types.map((t) => t.id).sort()).toEqual(
      ['apiKey', 'basicAuth', 'httpHeaderAuth', 'oauth2Manual'].sort(),
    );
    for (const type of typesBody.types) {
      expect(type.displayName).toBeTruthy();
      expect(type.fields.length).toBeGreaterThan(0);
    }

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Credential HTTP inject E2E',
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
            credentialId: created!.id,
            sendHeaders: false,
            sendQuery: false,
            sendBody: false,
          },
        },
      ],
      connections: [{ from: 't1', to: 'http1' }],
    };

    const createRes = await request.post('/api/workflows', {
      data: { name: definition.name, definition },
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: workflowId } = (await createRes.json()) as { id: string };

    const debugRes = await request.post('/api/workflows/debug-node', {
      data: {
        workflowId,
        definition,
        targetNodeId: 'http1',
        environment: 'test',
      },
    });
    expect(debugRes.ok()).toBeTruthy();
    const debugBody = (await debugRes.json()) as DebugNodeResponse;
    expect(debugBody.status).toBe('success');

    const httpItems = debugBody.nodeResults?.http1?.outputItems?.[0];
    expect(httpItems?.length).toBeGreaterThan(0);
    const responseJson = httpItems![0]!.json;
    const requestHeaders =
      (responseJson.request as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    const bodyHeaders =
      (responseJson.body as { headers?: Record<string, string> } | null)?.headers ?? {};
    const authHeader = String(
      requestHeaders.Authorization ??
        requestHeaders.authorization ??
        bodyHeaders.Authorization ??
        bodyHeaders.authorization ??
        '',
    );
    expect(authHeader).toContain(apiKeyValue);

    await page.goto(`/workflows/${workflowId}`);
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^HTTP$/ })
      .dblclick();
    await expect(page.locator('.node-editor-modal')).toBeVisible();
    await expect(page.locator('.node-editor-modal')).toContainText(credName);
  });
});
