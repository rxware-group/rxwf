import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-toolWorkflow — toolWorkflow 卫星面板与校验 (M-3 / plus matrix) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/toolWorkflow.md');
const SPEC_FILE = 'nodes/toolWorkflow.spec.ts';

type WorkflowDefinition = {
  schemaVersion: number;
  name: string;
  settings?: { exposeAsTool?: boolean };
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
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createWorkflow failed (${res.status()}): ${body}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function publishWorkflow(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
) {
  const res = await request.post(`/api/workflows/${workflowId}/publish`, { data: {} });
  expect(res.ok()).toBeTruthy();
}

async function validateDefinition(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
): Promise<{ ok: boolean; errors?: Array<{ code: string; message: string; nodeId?: string }> }> {
  const res = await request.post(`/api/workflows/${workflowId}/validate`, {
    data: { definition },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as {
    ok: boolean;
    errors?: Array<{ code: string; message: string; nodeId?: string }>;
  };
}

function agentWithToolWorkflowDefinition(
  toolParams: Record<string, unknown>,
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'ToolWorkflow agent E2E',
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
        parameters: { role: 'Assistant', goal: 'Help user' },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 0, y: 120 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'twf',
        type: 'toolWorkflow',
        name: 'RunChild',
        position: { x: 0, y: 220 },
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
      { from: 'twf', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    ],
  };
}

test.describe('toolWorkflow audit row @any', () => {
  test('AUDIT-N-toolWorkflow row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('satellite');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('toolWorkflow E2E-N-toolWorkflow @any', () => {
  test('panel shows sub-workflow select and tool description', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'ToolWorkflow panel E2E',
      nodes: [
        {
          id: 'twf',
          type: 'toolWorkflow',
          name: 'RunChild',
          position: { x: 0, y: 0 },
          parameters: {
            workflowId: '',
            toolDescription: 'Run child workflow as tool',
            inputMapping: {},
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
      .filter({ hasText: /^RunChild$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '子工作流' })).toBeVisible();
    await expect(
      modal.getByText('仅显示已发布且开启「作为 Agent Tool 暴露」的工作流。'),
    ).toBeVisible();
  });
});

test.describe('toolWorkflow E2E-N-toolWorkflow @plus', () => {
  test('validate fails when workflowId is missing', async ({ request }) => {
    const definition = agentWithToolWorkflowDefinition({
      toolDescription: 'Run child',
      inputMapping: {},
    });
    const workflowId = await createWorkflow(request, definition);
    const result = await validateDefinition(request, workflowId, definition);

    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.code === 'E1001' && e.nodeId === 'twf')).toBe(true);
  });

  test('validate passes when child workflow is published with exposeAsTool', async ({
    request,
  }) => {
    const childDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'ToolWorkflow child E2E',
      settings: { exposeAsTool: true },
      nodes: [
        {
          id: 'st1',
          type: 'subworkflowTrigger',
          name: 'Sub Trigger',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll', inputs: [], jsonExample: {} },
        },
        {
          id: 's1',
          type: 'set',
          name: 'Mark',
          position: { x: 220, y: 0 },
          parameters: { fields: { ok: true } },
        },
      ],
      connections: [{ from: 'st1', to: 's1' }],
    };

    const childId = await createWorkflow(request, childDefinition);
    await publishWorkflow(request, childId);

    const parentDefinition = agentWithToolWorkflowDefinition({
      workflowId: childId,
      toolDescription: 'Invoke published child',
      inputMapping: {},
    });
    const parentId = await createWorkflow(request, parentDefinition);
    const result = await validateDefinition(request, parentId, parentDefinition);

    expect(result.ok).toBe(true);
  });
});
