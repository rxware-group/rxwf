import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolSkill — toolSkill 卫星面板与执行路径 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolSkill.md');
const SPEC_FILE = 'nodes/toolSkill.spec.ts';

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

function uniqueName(base: string): string {
  return `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createWorkflow(
  request: import('@playwright/test').APIRequestContext,
  definition: WorkflowDefinition,
) {
  const name = uniqueName(definition.name);
  const res = await request.post('/api/workflows', {
    data: { name, definition: { ...definition, name } },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  targetNodeId: string,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

function standaloneToolSkillDefinition(
  toolParams: Record<string, unknown>,
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'ToolSkill panel E2E',
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 'tsk',
        type: 'toolSkill',
        name: 'RunSkill',
        position: { x: 0, y: 0 },
        parameters: toolParams,
      },
    ],
    connections: [],
  };
}

function standaloneToolSkillWithTriggerDefinition(
  toolParams: Record<string, unknown>,
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'ToolSkill standalone E2E',
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'tsk',
        type: 'toolSkill',
        name: 'RunSkill',
        position: { x: 240, y: 0 },
        parameters: toolParams,
      },
    ],
    connections: [{ from: 't1', to: 'tsk' }],
  };
}

function agentWithToolSkillDefinition(
  toolParams: Record<string, unknown>,
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'ToolSkill agent E2E',
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
        position: { x: 200, y: 0 },
        parameters: { sessionId: '' },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 80 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'tsk',
        type: 'toolSkill',
        name: 'RunSkill',
        position: { x: 200, y: 80 },
        parameters: toolParams,
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      {
        from: 'mdl',
        to: 'agt',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
      { from: 'tsk', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

test.describe('toolSkill audit row @any', () => {
  test('AUDIT-N-toolSkill row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolSkill E2E-N-toolSkill @any', () => {
  test('panel shows tool description, skill path, and mode fields', async ({ page, request }) => {
    const definition = standaloneToolSkillDefinition({
      toolDescription: 'Run a packaged skill as an agent tool',
      skillPath: 'hello',
      mode: 'sub-agent',
    });
    const workflowId = await createWorkflow(request, definition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^RunSkill$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Tool 描述', { exact: true })).toBeVisible();
    await expect(modal.getByText('Skill 名称', { exact: true })).toBeVisible();
    await expect(modal.getByText('模式', { exact: true })).toBeVisible();
  });

  test('debug-node fails toolSkill when invoked as standalone node (E2003)', async ({
    request,
  }) => {
    const definition = standaloneToolSkillWithTriggerDefinition({
      toolDescription: 'Run skill',
      skillPath: 'hello',
      mode: 'sub-agent',
    });

    const workflowId = await createWorkflow(request, definition);
    const result = await debugNode(request, workflowId, definition, 'tsk');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.tsk?.status).toBe('failed');
    expect(result.nodeResults?.tsk?.errorCode).toBe('E2003');
  });

  test('standalone toolSkill workflow saves and validates', async ({ request }) => {
    const definition = standaloneToolSkillDefinition({
      toolDescription: 'Invoke hello skill',
      skillPath: 'hello',
      mode: 'single-shot',
    });
    const workflowId = await createWorkflow(request, definition);
    const res = await request.post(`/api/workflows/${workflowId}/validate`, {
      data: { definition },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

test.describe('toolSkill E2E-N-toolSkill @plus', () => {
  test('agent hub with toolSkill satellite validates on plus profile', async ({ request }) => {
    const definition = agentWithToolSkillDefinition({
      toolDescription: 'Invoke hello skill',
      skillPath: 'hello',
      mode: 'single-shot',
    });
    const workflowId = await createWorkflow(request, definition);
    const res = await request.post(`/api/workflows/${workflowId}/validate`, {
      data: { definition },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
