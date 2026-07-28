import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolSubagent — toolSubagent 执行与面板 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolSubagent.md');
const SPEC_FILE = 'nodes/toolSubagent.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  settings?: { workflowKind?: string; maxAgentDepth?: number };
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

function agentWithSubagentDefinition(): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: `Tool Subagent execute ${Date.now()}`,
    settings: { workflowKind: 'agent', maxAgentDepth: 2 },
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
          userPromptTemplate: 'Reply briefly to: {{ $json.prompt }}',
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
        id: 'sub',
        type: 'toolSubagent',
        name: 'Research',
        position: { x: 240, y: 120 },
        parameters: {
          toolDescription: 'Run nested research subagent',
          systemPrompt: 'You are a concise research assistant.',
          taskPromptTemplate: 'Research: {{ $fromAI.query }}',
        },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 'sub', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

test.describe('toolSubagent audit row', () => {
  test('AUDIT-N-toolSubagent row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolSubagent E2E-N-toolSubagent @any', () => {
  test.describe.configure({ mode: 'serial' });

  test('validate returns E1049 when toolDescription or systemPrompt is missing', async ({
    request,
  }) => {
    const validDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Tool Subagent validate ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'sub',
          type: 'toolSubagent',
          name: 'Research',
          position: { x: 0, y: 0 },
          parameters: {
            toolDescription: 'Valid description',
            systemPrompt: 'Valid system prompt',
          },
        },
      ],
      connections: [],
    };

    const invalidDefinition: WorkflowDefinition = {
      ...validDefinition,
      nodes: [
        {
          ...validDefinition.nodes[0]!,
          parameters: { toolDescription: '', systemPrompt: '' },
        },
      ],
    };

    const workflowId = await createWorkflow(request, validDefinition);
    const result = await validateDefinition(request, workflowId, invalidDefinition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1049' && e.nodeId === 'sub')).toBe(true);
  });

  test('Subagent panel shows toolDescription, systemPrompt, and readonly fields', async ({
    page,
    request,
  }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: `Tool Subagent panel ${Date.now()}`,
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'sub',
          type: 'toolSubagent',
          name: 'Research',
          position: { x: 0, y: 0 },
          parameters: {
            toolDescription: 'Nested subagent',
            systemPrompt: 'You are helpful.',
            readonly: 'false',
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
      .filter({ hasText: /^Research$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Tool 描述' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'System Prompt' }),
    ).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'Task 模板' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '只读子 Agent' }),
    ).toBeVisible();
  });
});

test.describe('toolSubagent E2E-N-toolSubagent @plus', () => {
  test('debug-node executes aiAgent with wired toolSubagent when Ollama is reachable', async ({
    request,
  }) => {
    test.skip(!(await isOllamaReachable(request)), 'Ollama not reachable');

    const definition = agentWithSubagentDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'agt');

    expect(result.status).toBe('success');
    expect(result.nodeResults?.agt?.status).toBe('success');
    expect(String(result.nodeResults?.agt?.outputItems?.[0]?.[0]?.json.answer ?? '')).not.toBe('');
  });
});
