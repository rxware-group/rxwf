import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-llmStream — llmStream 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/llmStream.md');
const SPEC_FILE = 'nodes/llmStream.spec.ts';

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

async function debugLlmStreamNode(
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

test.describe('llmStream audit row', () => {
  test('AUDIT-N-llmStream row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('llmStream E2E-N-llmStream @any', () => {
  test('LLM Stream panel shows model and prompt fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM Stream panel E2E',
      nodes: [
        {
          id: 'llm1',
          type: 'llmStream',
          name: 'LLM Stream',
          position: { x: 0, y: 0 },
          parameters: { model: 'llama3', prompt: 'Say hello' },
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
      .filter({ hasText: /^LLM Stream$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Model' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Prompt' })).toBeVisible();
    await expect(modal.locator('.ollama-model-param-field')).toBeVisible();
  });
});

test.describe('llmStream E2E-N-llmStream @plus', () => {
  test('debug-node executes llmStream when model endpoint is reachable', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live chat smoke');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM Stream execute E2E',
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
          type: 'llmStream',
          name: 'LLM Stream',
          position: { x: 240, y: 0 },
          parameters: {
            model: 'llama3',
            prompt: 'Reply with exactly: rxwf-llmstream-ok',
          },
        },
      ],
      connections: [{ from: 't1', to: 'llm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugLlmStreamNode(request, workflowId, definition, 'llm1');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.llm1;
    expect(nodeResult?.status).toBe('success');
    const stream = String(nodeResult?.outputItems?.[0]?.[0]?.json.stream ?? '');
    expect(stream.length).toBeGreaterThan(0);
  });

  test('debug-node fails llmStream gracefully when model endpoint is down', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(ollamaUp, 'Ollama is reachable; skip down-endpoint failure path');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'LLM Stream down E2E',
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
          type: 'llmStream',
          name: 'LLM Stream',
          position: { x: 240, y: 0 },
          parameters: { prompt: 'ping' },
        },
      ],
      connections: [{ from: 't1', to: 'llm1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugLlmStreamNode(request, workflowId, definition, 'llm1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.llm1?.status).toBe('failed');
    expect(String(result.nodeResults?.llm1?.errorMessage ?? '')).toMatch(
      /E3001|connect|fetch|ECONNREFUSED|runtime/i,
    );
  });
});
