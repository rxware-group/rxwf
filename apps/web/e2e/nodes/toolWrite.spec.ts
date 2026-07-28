import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolWrite — toolWrite 卫星工具面板与执行路径 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolWrite.md');
const SPEC_FILE = 'nodes/toolWrite.spec.ts';

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

function e2eTempDir(suffix: string): string {
  return path.join(tmpdir(), `rxwf-e2e-toolwrite-${Date.now()}-${suffix}`);
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

test.describe('toolWrite audit row @any', () => {
  test('AUDIT-N-toolWrite row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolWrite E2E-N-toolWrite @any', () => {
  test('Tool (Write) panel shows builtin tool description and defaultEncoding', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Write panel E2E',
      nodes: [
        {
          id: 'tw1',
          type: 'toolWrite',
          name: 'write_file',
          position: { x: 0, y: 0 },
          parameters: {},
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
      .filter({ hasText: /^write_file$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Tool 描述', { exact: true })).toBeVisible();
    await expect(modal.locator('.node-builtin-tool-description')).toContainText('写入');
    await expect(modal.getByText('默认编码', { exact: true })).toBeVisible();
  });
});

test.describe('toolWrite E2E-N-toolWrite @plus @any', () => {
  test.describe.configure({ mode: 'serial' });

  test('debug-node fails when targeting toolWrite directly (no standalone executor)', async ({
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Write standalone E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'tw1',
          type: 'toolWrite',
          name: 'write_file',
          position: { x: 240, y: 0 },
          parameters: {},
        },
      ],
      connections: [{ from: 't1', to: 'tw1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'tw1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.tw1?.status).toBe('failed');
    expect(result.nodeResults?.tw1?.errorCode).toBe('E2003');
  });

  test('aiAgent with toolWrite satellite wires without E2003', async ({ request }) => {
    const workspaceRoot = e2eTempDir('ws');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool Write agent satellite E2E',
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
            workspaceRoot,
            systemPrompt: 'You are a test agent.',
            userMessage: 'Write a file.',
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
          id: 'tw1',
          type: 'toolWrite',
          name: 'write_file',
          position: { x: 240, y: 120 },
          parameters: {},
        },
      ],
      connections: [
        { from: 't1', to: 'agt' },
        { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
        { from: 'tw1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'agt');

    expect(result.nodeResults?.agt?.errorCode).not.toBe('E2003');
    expect(['success', 'failed']).toContain(result.status);
    if (result.status === 'failed') {
      const code = result.nodeResults?.agt?.errorCode;
      expect(code === 'E3001' || code === undefined || code === 'E1071').toBeTruthy();
    }
  });
});
