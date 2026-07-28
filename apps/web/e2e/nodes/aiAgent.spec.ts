import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-aiAgent — aiAgent 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/aiAgent.md');
const SPEC_FILE = 'nodes/aiAgent.spec.ts';

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

async function debugAiAgentNode(
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

function aiAgentPanelDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'AI Agent panel E2E',
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 'agt',
        type: 'aiAgent',
        name: 'AI Agent',
        position: { x: 240, y: 0 },
        parameters: {
          role: 'Researcher',
          goal: 'Research topics',
          prompt: 'Say hello',
          systemPrompt: 'You are helpful',
        },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 120 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      {
        from: 'mdl',
        to: 'agt',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
    ],
  };
}

function aiAgentExecuteDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'AI Agent execute E2E',
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
        name: 'AI Agent',
        position: { x: 240, y: 0 },
        parameters: {
          prompt: 'Reply with exactly: rxwf-aiagent-ok',
        },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 120 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      {
        from: 'mdl',
        to: 'agt',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
    ],
  };
}

test.describe('aiAgent audit row', () => {
  test('AUDIT-N-aiAgent row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('aiAgent E2E-N-aiAgent @any', () => {
  test('AI Agent panel shows prompt and crew fields', async ({ page, request }) => {
    const definition = aiAgentPanelDefinition();
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-agt').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Prompt', { exact: true })).toBeVisible();
    await expect(modal.getByText('System Prompt', { exact: true })).toBeVisible();

    await modal.getByRole('tab', { name: 'Crew' }).click();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '角色 (Crew)' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '目标 (Crew)' })).toBeVisible();
  });
});

test.describe('aiAgent E2E-N-aiAgent @plus', () => {
  test('debug-node fails aiAgent with E3010 when Chat Model is missing', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'AI Agent no model E2E',
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
          name: 'AI Agent',
          position: { x: 240, y: 0 },
          parameters: { prompt: 'hello' },
        },
      ],
      connections: [{ from: 'tr', to: 'agt' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugAiAgentNode(request, workflowId, definition, 'agt');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.agt?.status).toBe('failed');
    expect(result.nodeResults?.agt?.errorCode).toBe('E3010');
    expect(String(result.nodeResults?.agt?.errorMessage ?? '')).toMatch(/Chat Model/i);
  });

  test('debug-node executes aiAgent when model endpoint is reachable', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live agent smoke');

    const definition = aiAgentExecuteDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugAiAgentNode(request, workflowId, definition, 'agt');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.agt;
    expect(nodeResult?.status).toBe('success');
    const answer = String(nodeResult?.outputItems?.[0]?.[0]?.json.answer ?? '');
    expect(answer.length).toBeGreaterThan(0);
  });
});
