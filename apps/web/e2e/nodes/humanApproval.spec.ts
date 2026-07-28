import { test, expect } from '@playwright/test';

/** E2E-N-humanApproval — humanApproval 面板与 HITL 执行 (M-3 / lite) */

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
      metadata?: Record<string, unknown>;
    }
  >;
};

type ExecutionDetail = {
  status: string;
  nodeRuns: Array<{
    nodeId: string;
    nodeType: string;
    status: string;
    metadata?: Record<string, unknown>;
  }>;
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

function hitlWorkflowDefinition(name = 'Human Approval E2E'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: { json: { version: 'v2.1' } },
      },
      {
        id: 'ap',
        type: 'humanApproval',
        name: 'Approve',
        position: { x: 220, y: 0 },
        parameters: {
          prompt: 'Approve deploy {{ $json.version }}?',
          summaryField: '{{ $json.version }}',
          allowReject: 'true',
          allowSupplement: 'false',
          timeoutMs: 0,
          timeoutAction: 'reject',
        },
      },
      {
        id: 'set',
        type: 'set',
        name: 'After',
        position: { x: 440, y: 0 },
        parameters: { mode: 'manual', fields: { done: true } },
      },
    ],
    connections: [
      { from: 'tr', to: 'ap' },
      { from: 'ap', to: 'set' },
    ],
  };
}

test.describe('humanApproval E2E-N-humanApproval', () => {
  test('panel renders approval parameters in node editor', async ({ page, request }) => {
    const definition = hitlWorkflowDefinition(`Human Approval panel ${Date.now()}`);
    const workflowId = await createWorkflow(request, definition);

    await page.goto(`/workflows/${workflowId}`);
    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();

    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Approve$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('审批提示')).toBeVisible();
    await expect(modal.getByText('摘要字段（表达式）')).toBeVisible();
    await expect(modal.getByText('允许驳回')).toBeVisible();
    await expect(modal.getByText('允许补充输入')).toBeVisible();
  });

  test('debug-node pauses at humanApproval with waiting status', async ({ page, request }) => {
    void page;
    const definition = hitlWorkflowDefinition(`Human Approval debug ${Date.now()}`);
    const workflowId = await createWorkflow(request, definition);

    const debugRes = await request.post('/api/workflows/debug-node', {
      data: {
        workflowId,
        definition,
        targetNodeId: 'ap',
        environment: 'test',
      },
    });
    expect(debugRes.ok()).toBeTruthy();
    const debugBody = (await debugRes.json()) as DebugNodeResponse;
    expect(debugBody.nodeResults?.ap?.status).toBe('waiting');
  });

  test('execution waits at humanApproval then resumes on approve', async ({ page, request }) => {
    void page;
    const definition = hitlWorkflowDefinition(`Human Approval run ${Date.now()}`);
    const workflowId = await createWorkflow(request, definition);

    const runRes = await request.post(`/api/workflows/${workflowId}/executions`, {
      data: { mode: 'manual', environment: 'test' },
    });
    expect(runRes.ok()).toBeTruthy();
    const { executionId, status } = (await runRes.json()) as {
      executionId: string;
      status: string;
    };
    expect(status).toBe('waiting');

    const detailRes = await request.get(`/api/executions/${executionId}`);
    expect(detailRes.ok()).toBeTruthy();
    const detail = (await detailRes.json()) as ExecutionDetail;
    expect(detail.status).toBe('waiting');

    const waitingRun = detail.nodeRuns.find((nr) => nr.nodeId === 'ap');
    expect(waitingRun?.status).toBe('waiting');
    const hitl = waitingRun?.metadata?.hitl as { prompt?: string; summary?: string } | undefined;
    expect(hitl?.prompt).toContain('v2.1');
    expect(hitl?.summary).toBe('v2.1');

    const resumeRes = await request.post(`/api/executions/${executionId}/hitl/resume`, {
      data: { nodeId: 'ap', decision: 'approve', comment: 'ship it' },
    });
    expect(resumeRes.ok()).toBeTruthy();
    const resumed = (await resumeRes.json()) as { status: string };
    expect(resumed.status).toBe('success');

    const afterRes = await request.get(`/api/executions/${executionId}`);
    expect(afterRes.ok()).toBeTruthy();
    const after = (await afterRes.json()) as ExecutionDetail;
    expect(after.status).toBe('success');
    expect(after.nodeRuns.some((nr) => nr.nodeId === 'set' && nr.status === 'success')).toBe(true);
  });
});
