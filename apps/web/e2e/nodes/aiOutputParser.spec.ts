import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-aiOutputParser — aiOutputParser 面板与 Agent 结构化输出 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/aiOutputParser.md');
const SPEC_FILE = 'nodes/aiOutputParser.spec.ts';

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

const outputSchema = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
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

function agentWithParserDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: `AI Output Parser execute ${Date.now()}`,
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
          prompt:
            'Reply with ONLY valid JSON (no markdown, no extra text): {"answer":"rxwf-parser-ok"}',
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
        id: 'parser',
        type: 'aiOutputParser',
        name: 'Parser',
        position: { x: 240, y: 120 },
        parameters: { jsonSchema: outputSchema },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      {
        from: 'parser',
        to: 'agt',
        fromOutput: 'ai_outputParser',
        toInput: 'ai_outputParser',
      },
    ],
  };
}

test.describe('aiOutputParser audit row', () => {
  test('AUDIT-N-aiOutputParser row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('aiOutputParser E2E-N-aiOutputParser @any', () => {
  test('Output Parser panel shows Output JSON Schema field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `AI Output Parser panel ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'parser',
          type: 'aiOutputParser',
          name: 'Parser',
          position: { x: 0, y: 0 },
          parameters: { jsonSchema: outputSchema },
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
      .filter({ hasText: /^Parser$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Output JSON Schema' }),
    ).toBeVisible();
  });

  test('validate warns W1010 when aiOutputParser is orphaned', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `AI Output Parser orphan ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'parser',
          type: 'aiOutputParser',
          name: 'Parser',
          position: { x: 0, y: 0 },
          parameters: { jsonSchema: outputSchema },
        },
      ],
      connections: [],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await validateDefinition(request, workflowId, definition);

    expect(result.ok).toBe(true);
    expect(result.warnings?.some((w) => w.code === 'W1010' && w.nodeId === 'parser')).toBe(true);
  });
});

test.describe('aiOutputParser E2E-N-aiOutputParser @plus', () => {
  test('debug-node executes aiAgent with connected aiOutputParser when Ollama is reachable', async ({
    request,
  }) => {
    test.skip(!(await isOllamaReachable(request)), 'Ollama not reachable');

    const definition = agentWithParserDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'agt');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.agt;
    expect(nodeResult?.status).toBe('success');
    const item = nodeResult?.outputItems?.[0]?.[0]?.json;
    expect(item).toBeDefined();
    expect(String(item?.answer ?? '')).not.toBe('');
    const parsed = item?.parsed as Record<string, unknown> | undefined;
    if (parsed && typeof parsed.answer === 'string') {
      expect(parsed.answer.length).toBeGreaterThan(0);
    }
  });
});
