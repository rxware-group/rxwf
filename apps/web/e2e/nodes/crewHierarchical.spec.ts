import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-crewHierarchical — crewHierarchical 执行与面板 (M-3 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/crewHierarchical.md');
const SPEC_FILE = 'nodes/crewHierarchical.spec.ts';

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
      errorCode?: string;
      errorMessage?: string;
      outputItems?: Array<Array<{ json: Record<string, unknown> }>>;
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

async function debugCrewHierarchicalNode(
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

async function validateDefinition(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
): Promise<{ ok: boolean; errors?: Array<{ code: string; message: string }> }> {
  const res = await request.post(`/api/workflows/${workflowId}/validate`, {
    data: { definition },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as {
    ok: boolean;
    errors?: Array<{ code: string; message: string }>;
  };
}

async function createShellWorkflow(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  return createWorkflow(request, {
    schemaVersion: 1,
    name: `Shell ${Date.now()}`,
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  });
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

function hierarchicalExecuteDefinition(options?: {
  includeManager?: boolean;
  includeWorker?: boolean;
  name?: string;
}): WorkflowDefinition {
  const includeManager = options?.includeManager ?? true;
  const includeWorker = options?.includeWorker ?? true;
  const workflowName = options?.name ?? `Crew Hierarchical E2E ${Date.now()}`;
  const nodes: WorkflowDefinition['nodes'] = [
    {
      id: 'tr',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'crew',
      type: 'crewHierarchical',
      name: 'Crew',
      position: { x: 240, y: 0 },
      parameters: {
        maxDelegations: 5,
        allowParallelDelegation: true,
        executionBackend: 'native',
      },
    },
  ];
  const connections: WorkflowDefinition['connections'] = [{ from: 'tr', to: 'crew' }];

  if (includeManager) {
    nodes.push(
      {
        id: 'mgr',
        type: 'aiAgent',
        name: 'Manager',
        position: { x: 480, y: 0 },
        parameters: { role: 'Manager', goal: 'Delegate' },
      },
      {
        id: 'mdl-m',
        type: 'aiChatModel',
        name: 'Model M',
        position: { x: 480, y: 100 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't-m',
        type: 'toolHttp',
        name: 'Tool M',
        position: { x: 560, y: 100 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'mgr tool',
        },
      },
    );
    connections.push(
      { from: 'mgr', to: 'crew', fromOutput: 'crew_manager', toInput: 'crew_manager' },
      { from: 'mdl-m', to: 'mgr', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't-m', to: 'mgr', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    );
  }

  if (includeWorker) {
    nodes.push(
      {
        id: 'a1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 120 },
        parameters: { role: 'Researcher', goal: 'Research' },
      },
      {
        id: 'mdl1',
        type: 'aiChatModel',
        name: 'Model 1',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't1',
        type: 'toolHttp',
        name: 'Tool 1',
        position: { x: 0, y: 300 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'worker tool',
        },
      },
    );
    connections.push(
      { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't1', to: 'a1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    );
  }

  return {
    schemaVersion: 1,
    name: workflowName,
    settings: { workflowKind: 'agent' },
    nodes,
    connections,
  };
}

function hierarchicalPanelDefinition(): WorkflowDefinition {
  return hierarchicalExecuteDefinition({
    name: `Crew Hierarchical panel E2E ${Date.now()}`,
  });
}

test.describe('crewHierarchical audit row', () => {
  test('AUDIT-N-crewHierarchical row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('crewHierarchical E2E-N-crewHierarchical @any', () => {
  test('Crew Hierarchical panel shows delegation parameters', async ({ page, request }) => {
    const definition = hierarchicalPanelDefinition();
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-crew').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('执行后端')).toBeVisible();
    await expect(modal.getByText('Knowledge 注入模式')).toBeVisible();
    await expect(modal.getByText('最大委派轮次')).toBeVisible();
  });
});

test.describe('crewHierarchical E2E-N-crewHierarchical @plus @any', () => {
  test('validate returns E1031 when crew_manager is missing', async ({ request }) => {
    const shellId = await createShellWorkflow(request);
    const definition = hierarchicalExecuteDefinition({ includeManager: false });
    const result = await validateDefinition(request, shellId, definition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1031')).toBe(true);
  });

  test('validate returns E1032 when no crew_member workers', async ({ request }) => {
    const shellId = await createShellWorkflow(request);
    const definition = hierarchicalExecuteDefinition({ includeWorker: false });
    const result = await validateDefinition(request, shellId, definition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1032')).toBe(true);
  });

  test('debug-node executes native crewHierarchical when Ollama is reachable', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live crew hierarchical smoke');

    const definition = hierarchicalExecuteDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugCrewHierarchicalNode(request, workflowId, definition, 'crew');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.crew;
    expect(nodeResult?.status).toBe('success');
    const answer = String(nodeResult?.outputItems?.[0]?.[0]?.json.answer ?? '');
    expect(answer.length).toBeGreaterThan(0);
    expect(nodeResult?.outputItems?.[0]?.[0]?.json.process).toBe('hierarchical');
  });
});
