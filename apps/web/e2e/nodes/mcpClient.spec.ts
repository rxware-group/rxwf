import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-mcpClient — mcpClient 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/mcpClient.md');
const SPEC_FILE = 'nodes/mcpClient.spec.ts';
const runMcpLive = process.env.RXWF_E2E_MCP_LIVE === '1';

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

async function createMcpServer(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post('/api/mcp-servers', {
    data: {
      name: 'E2E FS MCP',
      transport: 'npx',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function listMcpTools(
  request: import('@playwright/test').APIRequestContext,
  serverId: string,
): Promise<string[]> {
  const res = await request.get(`/api/mcp-servers/${serverId}/tools`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { tools: string[] };
  return body.tools;
}

async function debugMcpClientNode(
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

test.describe('mcpClient audit row', () => {
  test('AUDIT-N-mcpClient row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('mcpClient E2E-N-mcpClient @any', () => {
  test('MCP Client panel shows server and tool fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'MCP Client panel E2E',
      nodes: [
        {
          id: 'mcp1',
          type: 'mcpClient',
          name: 'MCP Client',
          position: { x: 0, y: 0 },
          parameters: { serverId: '', tools: [] },
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
      .filter({ hasText: /^MCP Client$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'MCP Server' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Tool' })).toBeVisible();
    await expect(modal.locator('.mcp-client-fields')).toBeVisible();
  });
});

test.describe('mcpClient E2E-N-mcpClient @plus', () => {
  test('debug-node fails mcpClient when serverId is missing', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'MCP Client missing server E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'mcp1',
          type: 'mcpClient',
          name: 'MCP Client',
          position: { x: 240, y: 0 },
          parameters: { tools: ['list_directory'] },
        },
      ],
      connections: [{ from: 't1', to: 'mcp1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugMcpClientNode(request, workflowId, definition, 'mcp1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.mcp1?.status).toBe('failed');
    expect(String(result.nodeResults?.mcp1?.errorMessage ?? '')).toMatch(
      /E1004|E3011|E3012|serverId|MCP/i,
    );
  });

  test('debug-node executes mcpClient when MCP server is reachable', async ({ request }) => {
      test.skip(!runMcpLive, 'Set RXWF_E2E_MCP_LIVE=1 to run live MCP smoke');
      const serverId = await createMcpServer(request);
      const tools = await listMcpTools(request, serverId);
      expect(tools.length).toBeGreaterThan(0);

      const definition: WorkflowDefinition = {
        schemaVersion: 1,
        name: 'MCP Client execute E2E',
        nodes: [
          {
            id: 't1',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
          {
            id: 'mcp1',
            type: 'mcpClient',
            name: 'MCP Client',
            position: { x: 240, y: 0 },
            parameters: {
              serverId,
              tools: [tools[0]!],
            },
          },
        ],
        connections: [{ from: 't1', to: 'mcp1' }],
      };

      const workflowId = await createWorkflow(request, definition);
      const result = await debugMcpClientNode(request, workflowId, definition, 'mcp1');

      expect(result.status).toBe('success');
      expect(result.nodeResults?.mcp1?.status).toBe('success');
      expect(result.nodeResults?.mcp1?.outputItems?.[0]?.[0]?.json.result).toBeDefined();
    });
});
