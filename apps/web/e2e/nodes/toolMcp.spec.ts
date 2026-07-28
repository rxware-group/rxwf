import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolMcp — toolMcp 卫星面板与审查 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolMcp.md');
const SPEC_FILE = 'nodes/toolMcp.spec.ts';

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

function agentWithToolMcpDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'Agent with toolMcp E2E',
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
        id: 'mcp1',
        type: 'toolMcp',
        name: 'ListDir',
        position: { x: 0, y: 220 },
        parameters: {
          serverId: '',
          tools: ['list_directory'],
          toolDescription: 'List files in a directory via MCP',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'mcp1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

test.describe('toolMcp audit row', () => {
  test('AUDIT-N-toolMcp row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolMcp E2E-N-toolMcp @any', () => {
  test('Tool (MCP) panel shows server, tool, and tool description fields', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Tool MCP panel E2E',
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'mcp1',
          type: 'toolMcp',
          name: 'ListDir',
          position: { x: 0, y: 0 },
          parameters: {
            serverId: '',
            tools: [],
            toolDescription: 'List directory via MCP',
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
      .filter({ hasText: /^ListDir$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'MCP Server' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: /^Tool$/ })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Tool 描述' }),
    ).toBeVisible();
    await expect(modal.locator('.mcp-client-fields')).toBeVisible();
  });
});

test.describe('toolMcp E2E-N-toolMcp @plus', () => {
  test('debug-node fails when targeting toolMcp satellite directly', async ({ request }) => {
    const definition = agentWithToolMcpDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'mcp1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.mcp1?.status).toBe('failed');
    expect(
      result.nodeResults?.mcp1?.errorCode === 'E2003' ||
        String(result.nodeResults?.mcp1?.errorMessage ?? '').includes('E2003') ||
        String(result.nodeResults?.mcp1?.errorMessage ?? '').match(/Unknown node type|toolMcp/i),
    ).toBeTruthy();
  });

  test('validate passes for aiAgent workflow wired with toolMcp satellite', async ({
    request,
  }) => {
    const definition = agentWithToolMcpDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await validateDefinition(request, workflowId, definition);
    expect(result.ok).toBe(true);
  });
});
