import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-crewSupervisor — crewSupervisor 执行与面板 (M-3 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/crewSupervisor.md');
const SPEC_FILE = 'nodes/crewSupervisor.spec.ts';

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

async function debugCrewSupervisorNode(
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

function supervisorPanelDefinition(): WorkflowDefinition {
  return supervisorExecuteDefinition();
}

function supervisorExecuteDefinition(
  overrides?: Partial<WorkflowDefinition['nodes'][0]['parameters']>,
  options?: { includeWorker?: boolean },
): WorkflowDefinition {
  const includeWorker = options?.includeWorker ?? true;
  const nodes: WorkflowDefinition['nodes'] = [
    {
      id: 'tr',
      type: 'manualTrigger',
      name: 'Manual',
      position: { x: 0, y: 0 },
      parameters: {},
    },
    {
      id: 'sup',
      type: 'crewSupervisor',
      name: 'Supervisor',
      position: { x: 240, y: 0 },
      parameters: {
        maxSteps: 5,
        supervisorProvider: 'ollama',
        supervisorModel: 'llama3',
        ...overrides,
      },
    },
  ];
  const connections: WorkflowDefinition['connections'] = [{ from: 'tr', to: 'sup' }];

  if (includeWorker) {
    nodes.push(
      {
        id: 'w1',
        type: 'aiAgent',
        name: 'Researcher',
        position: { x: 0, y: 120 },
        parameters: { role: 'Researcher', goal: 'Research' },
      },
      {
        id: 'mdl-w',
        type: 'aiChatModel',
        name: 'Model W',
        position: { x: 0, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't-w',
        type: 'toolHttp',
        name: 'Tool W',
        position: { x: 80, y: 300 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'tool',
        },
      },
    );
    connections.push(
      { from: 'w1', to: 'sup', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl-w', to: 'w1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't-w', to: 'w1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    );
  }

  return {
    schemaVersion: 1,
    name: 'Crew Supervisor execute E2E',
    settings: { workflowKind: 'agent' },
    nodes,
    connections,
  };
}

test.describe('crewSupervisor audit row', () => {
  test('AUDIT-N-crewSupervisor row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('crewSupervisor E2E-N-crewSupervisor @any', () => {
  test('Crew Supervisor panel shows supervisor parameters', async ({ page, request }) => {
    const definition = supervisorPanelDefinition();
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-sup').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('最大监督步数')).toBeVisible();
    await expect(modal.getByText('Supervisor Model')).toBeVisible();
    await expect(modal.getByText('执行后端')).toBeVisible();
  });
});

test.describe('crewSupervisor E2E-N-crewSupervisor @plus', () => {
  test('validate returns E1032 when crewSupervisor has no crew_member workers', async ({
    request,
  }) => {
    const shellId = await createShellWorkflow(request);
    const definition = supervisorExecuteDefinition(undefined, { includeWorker: false });
    const result = await validateDefinition(request, shellId, definition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1032')).toBe(true);
  });

  test('validate returns E1035 when supervisor model is missing', async ({ request }) => {
    const shellId = await createShellWorkflow(request);
    const definition = supervisorExecuteDefinition({ supervisorModel: '' });
    const result = await validateDefinition(request, shellId, definition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1035')).toBe(true);
  });

  test('debug-node executes native crewSupervisor when Ollama is reachable', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live crew supervisor smoke');

    const definition = supervisorExecuteDefinition();
    const workflowId = await createWorkflow(request, definition);
    const result = await debugCrewSupervisorNode(request, workflowId, definition, 'sup');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.sup;
    expect(nodeResult?.status).toBe('success');
    const answer = String(nodeResult?.outputItems?.[0]?.[0]?.json.answer ?? '');
    expect(answer.length).toBeGreaterThan(0);
    expect(nodeResult?.outputItems?.[0]?.[0]?.json.process).toBe('supervisor');
  });
});
