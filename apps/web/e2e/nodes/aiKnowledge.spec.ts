import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-aiKnowledge — aiKnowledge 卫星节点面板与 Agent RAG (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/aiKnowledge.md');
const SPEC_FILE = 'nodes/aiKnowledge.spec.ts';

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

async function debugAgentNode(
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

function agentWithKnowledgeDefinition(
  kbIds: string[],
  prompt = 'aiKnowledge E2E marker query',
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'AI Knowledge agent E2E',
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'agt1',
        type: 'aiAgent',
        name: 'Agent',
        position: { x: 240, y: 0 },
        parameters: { prompt },
      },
      {
        id: 'mdl1',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 240, y: 120 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'kb1',
        type: 'aiKnowledge',
        name: 'Knowledge (RAG)',
        position: { x: 240, y: 240 },
        parameters: { knowledgeBaseIds: kbIds },
      },
    ],
    connections: [
      { from: 't1', to: 'agt1' },
      { from: 'mdl1', to: 'agt1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'kb1', to: 'agt1', fromOutput: 'ai_knowledge', toInput: 'ai_knowledge' },
    ],
  };
}

test.describe('aiKnowledge audit row', () => {
  test('AUDIT-N-aiKnowledge row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('aiKnowledge E2E-N-aiKnowledge @any', () => {
  test('Knowledge panel shows knowledge base field', async ({ page }) => {
    const request = page.request;
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'AI Knowledge panel E2E',
      nodes: [
        {
          id: 'kb1',
          type: 'aiKnowledge',
          name: 'Knowledge (RAG)',
          position: { x: 0, y: 0 },
          parameters: { knowledgeBaseIds: [] },
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
      .filter({ hasText: /^Knowledge \(RAG\)$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '知识库' })).toBeVisible();
  });

  test('debug-node fails aiAgent with E3003 when knowledge base has no indexed chunks', async ({
    page,
  }) => {
    const request = page.request;
    const kbId = await createKnowledgeBase(request, `AI Knowledge E2E empty KB ${Date.now()}`);
    const definition = agentWithKnowledgeDefinition([kbId]);
    const workflowId = await createWorkflow(request, definition);
    const result = await debugAgentNode(request, workflowId, definition, 'agt1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.agt1?.status).toBe('failed');
    expect(result.nodeResults?.agt1?.errorCode).toBe('E3003');
  });
});

test.describe('aiKnowledge E2E-N-aiKnowledge @plus', () => {
  test('debug-node runs aiAgent with knowledge when base is indexed', async ({ page }) => {
    const request = page.request;
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live Agent+Knowledge smoke');

    const kbId = await createKnowledgeBase(request, `AI Knowledge E2E indexed KB ${Date.now()}`);
    await uploadTextDocument(
      request,
      kbId,
      'rxwf-aiKnowledge.txt',
      'RX-Workflow aiKnowledge E2E marker phrase for agent RAG testing.',
    );

    const definition = agentWithKnowledgeDefinition(
      [kbId],
      'What does the aiKnowledge E2E marker phrase say?',
    );
    const workflowId = await createWorkflow(request, definition);
    const result = await debugAgentNode(request, workflowId, definition, 'agt1');

    expect(result.status).toBe('success');
    expect(result.nodeResults?.agt1?.status).toBe('success');
    const answer = String(result.nodeResults?.agt1?.outputItems?.[0]?.[0]?.json.answer ?? '');
    expect(answer.length).toBeGreaterThan(0);
  });
});
