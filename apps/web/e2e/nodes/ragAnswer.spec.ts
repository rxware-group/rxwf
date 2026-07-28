import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-ragAnswer — ragAnswer 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/ragAnswer.md');
const SPEC_FILE = 'nodes/ragAnswer.spec.ts';

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

async function debugRagAnswerNode(
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

async function createKnowledgeBase(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post('/api/knowledge-bases', {
    data: { name, similarityThreshold: 0.1 },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json() as { id: string }).id;
}

async function uploadTextDocument(
  request: import('@playwright/test').APIRequestContext,
  kbId: string,
  fileName: string,
  text: string,
): Promise<void> {
  const res = await request.post(`/api/knowledge-bases/${kbId}/documents`, {
    data: {
      fileName,
      mimeType: 'text/plain',
      contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    },
  });
  expect(res.ok()).toBeTruthy();
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

test.describe('ragAnswer audit row', () => {
  test('AUDIT-N-ragAnswer row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('ragAnswer E2E-N-ragAnswer @any', () => {
  test('RAG Answer panel shows knowledge base, model, query, template, and fallback fields', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Answer panel E2E ${Date.now()}`,
      nodes: [
        {
          id: 'rag1',
          type: 'ragAnswer',
          name: 'RAG 问答',
          position: { x: 0, y: 0 },
          parameters: {
            knowledgeBaseIds: [],
            query: 'What is rxwf?',
            ragTemplate: 'support',
            fallbackToChat: 'false',
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
      .filter({ hasText: /^RAG 问答$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '知识库' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Model' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '问题' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '模板' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '无命中回退纯对话' }),
    ).toBeVisible();
    await expect(modal.locator('.ollama-model-param-field')).toBeVisible();
    await expect(modal.locator('textarea')).toHaveValue('What is rxwf?');
  });
});

test.describe('ragAnswer E2E-N-ragAnswer @plus', () => {
  test('debug-node fails ragAnswer when knowledgeBaseIds is missing', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Answer missing kb E2E ${Date.now()}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rag1',
          type: 'ragAnswer',
          name: 'RAG 问答',
          position: { x: 240, y: 0 },
          parameters: { query: 'hello' },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagAnswerNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rag1?.status).toBe('failed');
    expect(result.nodeResults?.rag1?.errorCode).toBe('E1004');
  });

  test('debug-node fails ragAnswer when query is missing', async ({ request }) => {
    const kbId = await createKnowledgeBase(request, 'RAG Answer E2E empty query');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Answer missing query E2E ${Date.now()}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rag1',
          type: 'ragAnswer',
          name: 'RAG 问答',
          position: { x: 240, y: 0 },
          parameters: { knowledgeBaseIds: [kbId] },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagAnswerNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rag1?.status).toBe('failed');
    expect(result.nodeResults?.rag1?.errorCode).toBe('E1004');
  });

  test('debug-node falls back to chat on E3003 when fallbackToChat is true', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip fallback smoke');

    const kbId = await createKnowledgeBase(request, 'RAG Answer E2E empty KB');

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Answer fallback E2E ${Date.now()}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rag1',
          type: 'ragAnswer',
          name: 'RAG 问答',
          position: { x: 240, y: 0 },
          parameters: {
            knowledgeBaseIds: [kbId],
            query: 'rxwf-ragAnswer-miss-topic',
            fallbackToChat: 'true',
          },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagAnswerNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.rag1;
    expect(nodeResult?.status).toBe('success');
    const json = nodeResult?.outputItems?.[0]?.[0]?.json;
    expect(String(json?.answer ?? '').length).toBeGreaterThan(0);
    expect(json?.ragMiss).toBe(true);
    expect(json?.citations).toEqual([]);
  });

  test('debug-node generates answer with citations when knowledge base is indexed', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live RAG answer smoke');

    const kbId = await createKnowledgeBase(request, 'RAG Answer E2E indexed KB');
    await uploadTextDocument(
      request,
      kbId,
      'rxwf-rag-answer.txt',
      'RX-Workflow ragAnswer E2E marker phrase for retrieval and answer testing.',
    );

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Answer success E2E ${Date.now()}`,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rag1',
          type: 'ragAnswer',
          name: 'RAG 问答',
          position: { x: 240, y: 0 },
          parameters: {
            knowledgeBaseIds: [kbId],
            query: 'What is the ragAnswer E2E marker phrase?',
            fallbackToChat: 'false',
          },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagAnswerNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.rag1;
    expect(nodeResult?.status).toBe('success');
    const json = nodeResult?.outputItems?.[0]?.[0]?.json;
    expect(String(json?.answer ?? '').length).toBeGreaterThan(0);
    expect(json?.ragMiss).toBe(false);
    expect(Array.isArray(json?.citations)).toBe(true);
    expect((json?.citations as unknown[]).length).toBeGreaterThan(0);
  });
});
