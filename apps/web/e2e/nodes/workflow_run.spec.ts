import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-workflow_run — workflow_run 执行与面板 (M-3 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/workflow_run.md');
const SPEC_FILE = 'nodes/workflow_run.spec.ts';

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

function setupRxwfWorkspace(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'rxwf-e2e-wfr-'));
  const wfDir = path.join(root, '.rxwf', 'workflows');
  const skillDir = path.join(root, '.rxwf', 'skills', 'hello');
  mkdirSync(wfDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    path.join(wfDir, 'mini.workflow.yaml'),
    `id: mini
name: Mini E2E
steps:
  - id: s1
    skillRef: hello
    promptTemplate: "run"
`,
  );
  writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hello\npermissions:\n  - filesystem:read\n---\n\nE2E hello skill.\n',
  );
  writeFileSync(
    path.join(root, '.rxwf', 'rxwf.project.json'),
    JSON.stringify({ workflows: { enabled: true } }),
  );
  return root;
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
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function debugWorkflowRunNode(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  nodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId: nodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('workflow_run audit row', () => {
  test('AUDIT-N-workflow_run row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('workflow_run E2E-N-workflow_run @any', () => {
  test.describe.configure({ mode: 'serial' });

  test('Workflow Run panel shows source and template fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Workflow Run panel E2E',
      nodes: [
        {
          id: 'wfr1',
          type: 'workflow_run',
          name: 'Run WF',
          position: { x: 0, y: 0 },
          parameters: {
            workflowSource: 'template',
            workflowRelPath: 'mini',
            workspaceRoot: '',
            expandTemplate: 'true',
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
      .filter({ hasText: /^Run WF$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('工作流来源', { exact: true })).toBeVisible();
    await expect(modal.getByText('模板 (.rxwf/workflows)', { exact: true })).toBeVisible();
    await expect(modal.getByText('工作区', { exact: true })).toBeVisible();
    await expect(modal.getByText('展开模板', { exact: true })).toBeVisible();
  });

  test('debug-node fails workflow_run when template file is missing', async ({ request }) => {
    const workspaceRoot = setupRxwfWorkspace();
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Workflow Run missing template E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'wfr1',
          type: 'workflow_run',
          name: 'Run WF',
          position: { x: 240, y: 0 },
          parameters: {
            workflowSource: 'template',
            workflowRelPath: 'missing-template',
            workspaceRoot,
          },
        },
      ],
      connections: [{ from: 't1', to: 'wfr1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugWorkflowRunNode(request, workflowId, definition, 'wfr1', {
      t1: [{ json: {} }],
    });

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.wfr1?.status).toBe('failed');
    expect(result.nodeResults?.wfr1?.errorCode).toBe('E1073');
  });

  test('debug-node runs workflow_run template and returns child execution', async ({
    request,
  }) => {
    const workspaceRoot = setupRxwfWorkspace();
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Workflow Run execute E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'wfr1',
          type: 'workflow_run',
          name: 'Run WF',
          position: { x: 240, y: 0 },
          parameters: {
            workflowSource: 'template',
            workflowRelPath: 'mini',
            workspaceRoot,
            expandTemplate: 'true',
          },
        },
      ],
      connections: [{ from: 't1', to: 'wfr1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugWorkflowRunNode(request, workflowId, definition, 'wfr1', {
      t1: [{ json: { seed: 1 } }],
    });

    expect(result.status).toBe('success');
    const wfr = result.nodeResults?.wfr1;
    expect(wfr?.status).toBe('success');
    const json = wfr?.outputItems?.[0]?.[0]?.json ?? {};
    expect(json.templateId ?? json.compiled).toBeTruthy();
    if (json.childExecutionId) {
      expect(String(json.childExecutionId).length).toBeGreaterThan(0);
    }
  });
});