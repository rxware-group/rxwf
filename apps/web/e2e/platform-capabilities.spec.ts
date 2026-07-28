import { test, expect } from '@playwright/test';
import { hasDisallowedWorkflowCycle } from '@rxwf/workflow/graph-cycle';
import { validateConnections } from '../src/features/editor/validate-connections.ts';

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

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const res = await request.post('/api/workflows', {
    data: { name: `${definition.name} ${Date.now()}`, definition },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe('platform capabilities @smoke', () => {
  test('E2E-P-002 connection validation detects cycles', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Cycle validation',
      nodes: [
        {
          id: 'a',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'b',
          type: 'set',
          name: 'Set',
          position: { x: 200, y: 0 },
          parameters: {},
        },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };

    expect(
      hasDisallowedWorkflowCycle(
        definition.nodes,
        definition.connections,
      ),
    ).toBe(true);
    expect(validateConnections(definition)).toContain('Workflow graph contains a cycle');
  });

  test('E2E-P-004 execution history lists workflow runs', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Execution history E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: { json: { ping: true } },
        },
      ],
      connections: [],
    };

    const workflowId = await createWorkflow(request, definition);
    const runRes = await request.post(`/api/workflows/${workflowId}/executions`, {
      data: { environment: 'test' },
    });
    expect(runRes.ok()).toBeTruthy();
    const runBody = (await runRes.json()) as { executionId: string };
    expect(runBody.executionId).toBeTruthy();

    await page.goto(`/workflows/${workflowId}/executions/${runBody.executionId}`);
    await expect(page.locator('.editor-log-panel, .editor-log-body').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('E2E-P-006 debug-node accepts pinData for partial run', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Pin debug E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'm1',
          type: 'merge',
          name: 'Merge',
          position: { x: 240, y: 0 },
          parameters: { mode: 'append', inputCount: 2 },
        },
      ],
      connections: [{ from: 't1', to: 'm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const res = await request.post('/api/workflows/debug-node', {
      data: {
        workflowId,
        definition,
        targetNodeId: 'm1',
        pinData: {
          t1: [{ json: { branch: 'pinned' } }],
        },
        environment: 'test',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      status: string;
      nodeResults?: Record<string, { status: string }>;
    };
    expect(body.status).toBe('success');
    expect(body.nodeResults?.m1?.status).toBe('success');
  });

  test('E2E-P-008 node editor help button opens node doc', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Help button E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    await page
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Manual$/ })
      .dblclick();
    await expect(page.locator('.node-editor-modal')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.locator('.node-editor-modal .rxwf-modal-help-btn').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(/\/help\/nodes\/manualTrigger/);
    await expect(popup.locator('.help-doc-page--missing')).toHaveCount(0);
  });

  test('E2E-P-009 authenticated session loads workflow home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '工作流', level: 2 })).toBeVisible();
  });

  test('E2E-P-010 settings env page renders global variables table', async ({ page }) => {
    await page.goto('/settings/env');
    await expect(page.locator('.env-vars-table')).toBeVisible();
  });

  test('E2E-P-012 workflow JSON import via API create', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'JSON import E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: { json: { imported: true } },
        },
      ],
      connections: [],
    };

    const res = await request.post('/api/workflows', {
      data: { name: definition.name, definition },
    });
    expect(res.ok()).toBeTruthy();
    const { id } = (await res.json()) as { id: string };
    const getRes = await request.get(`/api/workflows/${id}`);
    expect(getRes.ok()).toBeTruthy();
    const wf = (await getRes.json()) as { workflow: { definition: WorkflowDefinition } };
    expect(wf.workflow.definition.nodes[0]?.parameters.json).toEqual({ imported: true });
  });

  test('E2E-P-016 runners API lists registered runners', async ({ request }) => {
    const res = await request.get('/api/runners');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { runners: unknown[] };
    expect(Array.isArray(body.runners)).toBe(true);
  });
});
