import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-groupChat — groupChat 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/groupChat.md');
const SPEC_FILE = 'nodes/groupChat.spec.ts';

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
      outputItems?: Array<Array<{ json: Record<string, unknown> }>>;
      errorCode?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
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
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createWorkflow failed (${res.status()}): ${body}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

function groupChatPanelDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: `Group Chat panel ${Date.now()}`,
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
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 240, y: 0 },
        parameters: {
          maxRounds: 8,
          speakerSelection: 'roundRobin',
          userProxyEnabled: 'false',
        },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Analyst',
        position: { x: 0, y: 120 },
        parameters: { role: 'Analyst', goal: 'Analyze' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Reviewer',
        position: { x: 160, y: 120 },
        parameters: { role: 'Reviewer', goal: 'Review' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  };
}

async function debugGroupChatNode(
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

function roundRobinGroupChatDefinition(name: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
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
        id: 'gc',
        type: 'groupChat',
        name: 'Group Chat',
        position: { x: 240, y: 0 },
        parameters: { maxRounds: 2, speakerSelection: 'roundRobin' },
      },
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Analyst',
        position: { x: 0, y: 120 },
        parameters: { role: 'Analyst', goal: 'Analyze' },
      },
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Reviewer',
        position: { x: 160, y: 120 },
        parameters: { role: 'Reviewer', goal: 'Review' },
      },
      {
        id: 'm1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'm2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 160, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'gc' },
      { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
      { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'm2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  };
}

async function isOllamaReachable(
  request: import('@playwright/test').APIRequestContext,
): Promise<boolean> {
  try {
    const res = await request.get('/api/models/providers');
    if (!res.ok()) return false;
    const body = (await res.json()) as {
      providers?: Array<{ kind?: string; enabled?: boolean; baseUrl?: string }>;
    };
    const ollama = body.providers?.find((p) => p.kind === 'ollama' && p.enabled);
    if (!ollama?.baseUrl?.trim()) return false;
    const ping = await fetch(`${ollama.baseUrl.replace(/\/$/, '')}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    return ping.ok;
  } catch {
    return false;
  }
}

test.describe('groupChat audit row', () => {
  test('AUDIT-N-groupChat row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('groupChat E2E-N-groupChat @any', () => {
  test('Group Chat panel shows orchestration parameters', async ({ page, request }) => {
    const definition = groupChatPanelDefinition();
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-gc').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '最大发言轮次' }),
    ).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '发言策略' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '启用 UserProxy' }),
    ).toBeVisible();
  });
});

test.describe('groupChat E2E-N-groupChat @plus', () => {
  test('debug-node fails groupChat with E1048 when members are missing', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Group Chat missing members',
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
          id: 'gc',
          type: 'groupChat',
          name: 'Group Chat',
          position: { x: 240, y: 0 },
          parameters: { maxRounds: 2 },
        },
      ],
      connections: [{ from: 'tr', to: 'gc' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugGroupChatNode(request, workflowId, definition, 'gc');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.gc?.status).toBe('failed');
    expect(result.nodeResults?.gc?.errorCode).toBe('E1048');
  });

  test('debug-node runs round-robin groupChat when Ollama is reachable', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live group chat smoke');

    const definition = roundRobinGroupChatDefinition('Group Chat round-robin E2E');
    const workflowId = await createWorkflow(request, definition);
    const result = await debugGroupChatNode(request, workflowId, definition, 'gc');

    expect(result.status).toBe('success');
    const gcResult = result.nodeResults?.gc;
    expect(gcResult?.status).toBe('success');
    const json = gcResult?.outputItems?.[0]?.[0]?.json ?? {};
    expect(Array.isArray(json.transcript)).toBe(true);
    expect((json.transcript as unknown[]).length).toBeGreaterThanOrEqual(1);
    const agentSteps = gcResult?.metadata?.agentSteps as
      | Array<{ output?: { type?: string } }>
      | undefined;
    expect(
      agentSteps?.some((s) => s.output?.type === 'groupChatTurn') ?? false,
    ).toBe(true);
  });
});
