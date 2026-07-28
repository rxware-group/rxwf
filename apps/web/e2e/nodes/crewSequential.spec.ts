import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-crewSequential — crewSequential 执行与面板 (M-3 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/crewSequential.md');
const SPEC_FILE = 'nodes/crewSequential.spec.ts';

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

async function debugCrewSequentialNode(
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

function crewPanelDefinition(): WorkflowDefinition {
  return crewExecuteDefinition({
    memberCount: 2,
    name: `Crew Sequential panel E2E ${Date.now()}`,
  });
}

function crewExecuteDefinition(options?: {
  memberCount?: 1 | 2;
  name?: string;
}): WorkflowDefinition {
  const memberCount = options?.memberCount ?? 2;
  const workflowName = options?.name ?? `Crew Sequential E2E ${Date.now()}`;
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
      type: 'crewSequential',
      name: 'Crew',
      position: { x: 240, y: 0 },
      parameters: { executionBackend: 'native' },
    },
    {
      id: 'a1',
      type: 'aiAgent',
      name: 'Researcher',
      position: { x: 0, y: 120 },
      parameters: { role: 'Researcher', goal: 'Summarize input' },
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
        toolDescription: 'fetch',
      },
    },
  ];
  const connections: WorkflowDefinition['connections'] = [
    { from: 'tr', to: 'crew' },
    { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'mdl1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 't1', to: 'a1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ];

  if (memberCount === 2) {
    nodes.push(
      {
        id: 'a2',
        type: 'aiAgent',
        name: 'Writer',
        position: { x: 240, y: 120 },
        parameters: { role: 'Writer', goal: 'Polish prior answer' },
      },
      {
        id: 'mdl2',
        type: 'aiChatModel',
        name: 'Model 2',
        position: { x: 240, y: 220 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 't2',
        type: 'toolHttp',
        name: 'Tool 2',
        position: { x: 240, y: 300 },
        parameters: {
          method: 'GET',
          url: 'https://example.com',
          toolDescription: 'fetch',
        },
      },
    );
    connections.push(
      { from: 'a2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
      { from: 'mdl2', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
      { from: 't2', to: 'a2', fromOutput: 'ai_tool', toInput: 'ai_tool' },
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

test.describe('crewSequential audit row', () => {
  test('AUDIT-N-crewSequential row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('crewSequential E2E-N-crewSequential @any', () => {
  test('Crew Sequential panel shows execution backend field', async ({ page, request }) => {
    const definition = crewPanelDefinition();
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await page.getByTestId('rf__node-crew').dblclick({ force: true });

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('执行后端')).toBeVisible();
    await expect(modal.getByText('Knowledge 注入模式')).toBeVisible();
  });
});

test.describe('crewSequential E2E-N-crewSequential @plus', () => {
  test('debug-node fails with E1030 when fewer than two crew_member workers', async ({
    request,
  }) => {
    const definition = crewExecuteDefinition({ memberCount: 1 });
    const workflowId = await createWorkflow(request, definition);
    const result = await debugCrewSequentialNode(request, workflowId, definition, 'crew');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.crew?.status).toBe('failed');
    expect(result.nodeResults?.crew?.errorCode).toBe('E1030');
  });

  test('debug-node executes native crewSequential when Ollama is reachable', async ({
    request,
  }) => {
    const ollamaUp = await isOllamaReachable(request);
    test.skip(!ollamaUp, 'Ollama endpoint not reachable; skip live crew smoke');

    const definition = crewExecuteDefinition({ memberCount: 2 });
    const workflowId = await createWorkflow(request, definition);
    const result = await debugCrewSequentialNode(request, workflowId, definition, 'crew');

    expect(result.status).toBe('success');
    const nodeResult = result.nodeResults?.crew;
    expect(nodeResult?.status).toBe('success');
    const answer = String(nodeResult?.outputItems?.[0]?.[0]?.json.answer ?? '');
    expect(answer.length).toBeGreaterThan(0);
    const crewSteps = nodeResult?.outputItems?.[0]?.[0]?.json.crewSteps;
    expect(Array.isArray(crewSteps)).toBe(true);
    expect((crewSteps as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});
