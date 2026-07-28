import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolWebSearch — toolWebSearch 卫星工具面板与执行路径 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolWebSearch.md');
const SPEC_FILE = 'nodes/toolWebSearch.spec.ts';

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
  connections: Array<{ from: string; to: string; fromOutput?: string; toInput?: string }>;
};

type DebugNodeResponse = {
  status: string;
  nodeResults?: Record<
    string,
    {
      status: string;
      outputItems?: Array<Array<{ json: Record<string, unknown> }>>;
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
  expect(res.ok()).toBeTruthy();
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

test.describe('toolWebSearch audit row @any', () => {
  test('AUDIT-N-toolWebSearch row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolWebSearch E2E-N-toolWebSearch @any', () => {
  test('Tool (Web Search) panel shows provider fields and builtin tool description', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Web Search panel E2E',
      nodes: [
        {
          id: 'ws1',
          type: 'toolWebSearch',
          name: 'web_search',
          position: { x: 0, y: 0 },
          parameters: {
            inheritConfig: 'true',
            credentialMode: 'platform',
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
      .filter({ hasText: /^web_search$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Tool 描述', { exact: true })).toBeVisible();
    await expect(modal.locator('.node-builtin-tool-description')).toContainText('搜索');
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '继承系统配置' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '凭证模式' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Provider' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Credential ID' })).toBeVisible();
  });
});

test.describe('toolWebSearch E2E-N-toolWebSearch @plus @any', () => {
  test('debug-node fails when targeting toolWebSearch directly (no standalone executor)', async ({
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Web Search standalone E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'ws1',
          type: 'toolWebSearch',
          name: 'web_search',
          position: { x: 240, y: 0 },
          parameters: { inheritConfig: 'true' },
        },
      ],
      connections: [{ from: 't1', to: 'ws1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'ws1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.ws1?.status).toBe('failed');
    expect(result.nodeResults?.ws1?.errorCode).toBe('E2003');
  });

  test('aiAgent with toolWebSearch satellite wires without standalone executor error', async ({
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Web Search agent satellite E2E',
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 't1',
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
          parameters: {
            systemPrompt: 'You are a test agent.',
            userMessage: 'Search the web.',
          },
        },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'Model',
          position: { x: 0, y: 120 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 'ws1',
          type: 'toolWebSearch',
          name: 'web_search',
          position: { x: 240, y: 120 },
          parameters: { inheritConfig: 'true', credentialMode: 'platform' },
        },
      ],
      connections: [
        { from: 't1', to: 'agt' },
        { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'ws1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'agt');

    expect(result.nodeResults?.agt?.errorCode).not.toBe('E2003');
    expect(['success', 'failed']).toContain(result.status);
    if (result.status === 'failed') {
      const code = result.nodeResults?.agt?.errorCode;
      expect(code === 'E3001' || code === 'E1071' || code === undefined).toBeTruthy();
    }
  });
});
