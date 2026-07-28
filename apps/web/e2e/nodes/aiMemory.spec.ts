import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-aiMemory — aiMemory 面板与 Agent 记忆路径 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/aiMemory.md');
const SPEC_FILE = 'nodes/aiMemory.spec.ts';

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
    }
  >;
};

type ValidateResponse = {
  ok: boolean;
  errors?: Array<{ code: string; message: string; nodeId?: string }>;
  warnings?: Array<{ code: string; message: string; nodeId?: string }>;
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

async function validateDefinition(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
): Promise<ValidateResponse> {
  const res = await request.post(`/api/workflows/${workflowId}/validate`, {
    data: { definition },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as ValidateResponse;
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

function agentWithMemoryDefinition(sessionId = 'e2e-memory-session'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: `AI Memory execute ${Date.now()}`,
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
        parameters: {
          userPromptTemplate: '{{ $json.prompt }}',
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
        id: 'mem',
        type: 'aiMemory',
        name: 'Memory',
        position: { x: 240, y: 120 },
        parameters: { sessionId, maxTurns: 5 },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'mem', to: 'agt', fromOutput: 'ai_memory', toInput: 'ai_memory' },
    ],
  };
}

test.describe('aiMemory audit row', () => {
  test('AUDIT-N-aiMemory row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('aiMemory E2E-N-aiMemory @any', () => {
  test('Memory panel shows Session ID and Max turns fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `AI Memory panel ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'mem',
          type: 'aiMemory',
          name: 'Memory',
          position: { x: 0, y: 0 },
          parameters: { sessionId: '', maxTurns: 20 },
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
      .filter({ hasText: /^Memory$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Session ID' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Max turns' })).toBeVisible();
  });

  test('validate warns W1010 when aiMemory is orphaned', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `AI Memory orphan ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'mem',
          type: 'aiMemory',
          name: 'Memory',
          position: { x: 0, y: 0 },
          parameters: { sessionId: 'orphan', maxTurns: 10 },
        },
      ],
      connections: [],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await validateDefinition(request, workflowId, definition);

    expect(result.ok).toBe(true);
    expect(result.warnings?.some((w) => w.code === 'W1010' && w.nodeId === 'mem')).toBe(true);
  });
});

test.describe('aiMemory E2E-N-aiMemory @plus', () => {
  test('debug-node executes aiAgent with connected aiMemory when Ollama is reachable', async ({
    request,
  }) => {
    test.skip(!(await isOllamaReachable(request)), 'Ollama not reachable');

    const definition = agentWithMemoryDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'agt');

    expect(result.status).toBe('success');
    expect(result.nodeResults?.agt?.status).toBe('success');
    expect(String(result.nodeResults?.agt?.outputItems?.[0]?.[0]?.json.answer ?? '')).not.toBe('');
  });
});
