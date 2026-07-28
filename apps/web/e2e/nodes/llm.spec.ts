import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-llm — llm 执行与面板 (M-3 / plus matrix, standard verify) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/llm.md');
const SPEC_FILE = 'nodes/llm.spec.ts';

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

async function debugLlmNode(
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

test.describe('llm audit row', () => {
  test('AUDIT-N-llm row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('llm E2E-N-llm @any', () => {
  test('LLM panel shows model and prompt fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM panel E2E',
      nodes: [
        {
          id: 'llm1',
          type: 'llm',
          name: 'LLM',
          position: { x: 0, y: 0 },
          parameters: { model: 'llama3', prompt: 'Say hello', baseUrl: 'http://127.0.0.1:11434' },
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
      .filter({ hasText: /^LLM$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '服务地址' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Model' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Prompt' })).toBeVisible();
    await expect(modal.locator('.ollama-model-param-field')).toBeVisible();
  });
});

test.describe('llm E2E-N-llm @standard', () => {
  test('debug-node executes llm when model endpoint is reachable', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live chat smoke');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM execute E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'llm1',
          type: 'llm',
          name: 'LLM',
          position: { x: 240, y: 0 },
          parameters: {
            baseUrl: 'http://127.0.0.1:11434',
            model: 'llama3',
            prompt: 'Reply with exactly: rxwf-llm-ok',
          },
        },
      ],
      connections: [{ from: 't1', to: 'llm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugLlmNode(request, workflowId, definition, 'llm1');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.llm1;
    expect(nodeResult?.status).toBe('success');
    const response = String(nodeResult?.outputItems?.[0]?.[0]?.json.response ?? '');
    expect(response.length).toBeGreaterThan(0);
  });

  test('debug-node fails llm gracefully when model endpoint is down', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(ollamaUp, 'Ollama is reachable; skip down-endpoint failure path');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM down E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'llm1',
          type: 'llm',
          name: 'LLM',
          position: { x: 240, y: 0 },
          parameters: { prompt: 'ping' },
        },
      ],
      connections: [{ from: 't1', to: 'llm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugLlmNode(request, workflowId, definition, 'llm1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.llm1?.status).toBe('failed');
    expect(String(result.nodeResults?.llm1?.errorMessage ?? '')).toMatch(
      /E3001|connect|fetch|ECONNREFUSED|runtime/i,
    );
  });
});
