import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-ragRetrieve — ragRetrieve 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/ragRetrieve.md');
const SPEC_FILE = 'nodes/ragRetrieve.spec.ts';

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

async function debugRagRetrieveNode(
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

test.describe('ragRetrieve audit row', () => {
  test('AUDIT-N-ragRetrieve row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('ragRetrieve E2E-N-ragRetrieve @any', () => {
  test('RAG Retrieve panel shows query and knowledge base fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Retrieve panel E2E ${Date.now()}`,
      nodes: [
        {
          id: 'rag1',
          type: 'ragRetrieve',
          name: 'RAG 检索',
          position: { x: 0, y: 0 },
          parameters: { query: 'What is RXWF?', knowledgeBaseIds: [] },
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
      .filter({ hasText: /^RAG 检索$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '查询' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '知识库' })).toBeVisible();
    await expect(modal.locator('textarea')).toHaveValue('What is RXWF?');
  });

  test('debug-node fails ragRetrieve when knowledgeBaseIds is missing', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Retrieve missing kb E2E ${Date.now()}`,
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
          type: 'ragRetrieve',
          name: 'RAG 检索',
          position: { x: 240, y: 0 },
          parameters: { query: 'hello' },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagRetrieveNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rag1?.status).toBe('failed');
    expect(result.nodeResults?.rag1?.errorCode).toBe('E1004');
  });

  test('debug-node fails ragRetrieve when query is missing', async ({ request }) => {
    const kbId = await createKnowledgeBase(request, `RAG Retrieve E2E empty query ${Date.now()}`);

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Retrieve missing query E2E ${Date.now()}`,
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
          type: 'ragRetrieve',
          name: 'RAG 检索',
          position: { x: 240, y: 0 },
          parameters: { knowledgeBaseIds: [kbId] },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagRetrieveNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rag1?.status).toBe('failed');
    expect(result.nodeResults?.rag1?.errorCode).toBe('E1004');
  });

  test('debug-node fails ragRetrieve with E3003 when knowledge base has no indexed chunks', async ({
    request,
  }) => {
    const kbId = await createKnowledgeBase(request, `RAG Retrieve E2E empty KB ${Date.now()}`);

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Retrieve no hits E2E ${Date.now()}`,
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
          type: 'ragRetrieve',
          name: 'RAG 检索',
          position: { x: 240, y: 0 },
          parameters: { knowledgeBaseIds: [kbId], query: 'rxwf-ragRetrieve-miss' },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagRetrieveNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rag1?.status).toBe('failed');
    expect(result.nodeResults?.rag1?.errorCode).toBe('E3003');
  });

  test('debug-node retrieves chunks when knowledge base is indexed', async ({ request }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live RAG retrieve smoke');

    const kbId = await createKnowledgeBase(request, `RAG Retrieve E2E indexed KB ${Date.now()}`);
    await uploadTextDocument(
      request,
      kbId,
      'rxwf-rag.txt',
      'RX-Workflow ragRetrieve E2E marker phrase for retrieval testing.',
    );

    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `RAG Retrieve success E2E ${Date.now()}`,
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
          type: 'ragRetrieve',
          name: 'RAG 检索',
          position: { x: 240, y: 0 },
          parameters: {
            knowledgeBaseIds: [kbId],
            query: 'ragRetrieve E2E marker',
          },
        },
      ],
      connections: [{ from: 't1', to: 'rag1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugRagRetrieveNode(request, workflowId, definition, 'rag1');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.rag1;
    expect(nodeResult?.status).toBe('success');
    const chunks = nodeResult?.outputItems?.[0];
    expect(chunks?.length).toBeGreaterThan(0);
    expect(String(chunks?.[0]?.json.text ?? '')).toMatch(/ragRetrieve E2E marker/i);
  });
});
