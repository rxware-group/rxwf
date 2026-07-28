import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolHttp — toolHttp 卫星面板与审查 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolHttp.md');
const SPEC_FILE = 'nodes/toolHttp.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  settings?: { workflowKind?: string };
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
    toInput?: string;
  }>;
};

type DebugNodeResponse = {
  status: string;
  nodeResults?: Record<
    string,
    {
      status: string;
      errorCode?: string;
      errorMessage?: string;
    }
  >;
};

function readAuditRowField(field: string): string {
  const content = readFileSync(auditRowPath, 'utf8');
  const match = content.match(
    new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'i'),
  );
  if (!match) {
    throw new Error(`audit row field "${field}" missing from ${auditRowPath}`);
  }
  return match[1]!.trim();
}

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

async function debugNode(
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

async function validateDefinition(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
): Promise<{ ok: boolean; errors?: Array<{ code: string; message: string }> }> {
  const res = await request.post(`/api/workflows/${workflowId}/validate`, {
    data: { definition },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as {
    ok: boolean;
    errors?: Array<{ code: string; message: string }>;
  };
}

function agentWithToolHttpDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Agent with toolHttp E2E',
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'agt',
        type: 'aiAgent',
        name: 'Agent',
        position: { x: 240, y: 0 },
        parameters: { role: 'Assistant', goal: 'Help user' },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 120 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'http1',
        type: 'toolHttp',
        name: 'FetchApi',
        position: { x: 0, y: 220 },
        parameters: {
          method: 'GET',
          url: 'https://httpbin.org/get',
          toolDescription: 'Fetch JSON from httpbin',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'http1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

test.describe('toolHttp audit row', () => {
  test('AUDIT-N-toolHttp row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolHttp E2E-N-toolHttp @any', () => {
  test('Tool (HTTP) panel shows method, url, headers, body, and tool description fields', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool HTTP panel E2E',
      nodes: [
        {
          id: 'http1',
          type: 'toolHttp',
          name: 'FetchApi',
          position: { x: 0, y: 0 },
          parameters: {
            method: 'GET',
            url: 'https://httpbin.org/get',
            headers: { Accept: 'application/json' },
            body: '',
            toolDescription: 'Fetch data',
          },
        },
      ],
      connections: [],
    };

    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^FetchApi$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '方法' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'URL' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Headers (JSON)' }),
    ).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Body' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Tool 描述' }),
    ).toBeVisible();
  });

  test('debug-node fails when targeting toolHttp satellite directly', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool HTTP standalone E2E',
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
          type: 'toolHttp',
          name: 'FetchApi',
          position: { x: 240, y: 0 },
          parameters: {
            method: 'GET',
            url: 'https://httpbin.org/get',
            toolDescription: 'Fetch JSON from httpbin',
          },
        },
      ],
      connections: [{ from: 't1', to: 'http1' }],
    };
    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'http1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.http1?.status).toBe('failed');
    expect(result.nodeResults?.http1?.errorCode).toBe('E2003');
  });

  test('validate passes for aiAgent workflow wired with toolHttp satellite', async ({
    request,
  }) => {
    const definition = agentWithToolHttpDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await validateDefinition(request, workflowId, definition);
    expect(result.ok).toBe(true);
  });
});
