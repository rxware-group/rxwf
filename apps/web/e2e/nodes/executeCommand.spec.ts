import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-executeCommand — executeCommand 执行与面板 (M-3 / standard) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/executeCommand.md');
const SPEC_FILE = 'nodes/executeCommand.spec.ts';

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

function executeCommandParameters(message: string): Record<string, unknown> {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'echo', message] };
  }
  return { command: 'echo', args: [message] };
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

async function debugExecuteCommandNode(
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

test.describe('executeCommand audit row', () => {
  test('AUDIT-N-executeCommand row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('executeCommand E2E-N-executeCommand @any', () => {
  test('Execute Command panel shows command, args, and cwd fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Execute Command panel E2E',
      nodes: [
        {
          id: 'cmd1',
          type: 'executeCommand',
          name: 'Run',
          position: { x: 0, y: 0 },
          parameters: executeCommandParameters('panel-check'),
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
      .filter({ hasText: /^Run$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '命令' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: /^参数$/ })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '工作目录（可选）' }),
    ).toBeVisible();
    await expect(modal.locator('.command-args-editor')).toBeVisible();
  });

  test('debug-node runs executeCommand and returns stdout', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Execute Command E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'cmd1',
          type: 'executeCommand',
          name: 'Run',
          position: { x: 240, y: 0 },
          parameters: executeCommandParameters('e2e-rxwf-cmd'),
        },
      ],
      connections: [{ from: 't1', to: 'cmd1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugExecuteCommandNode(request, workflowId, definition, 'cmd1');

    expect(result.status).toBe('success');
    const cmdResult = result.nodeResults?.cmd1;
    expect(cmdResult?.status).toBe('success');
    expect(String(cmdResult?.outputItems?.[0]?.[0]?.json.stdout ?? '')).toContain(
      'e2e-rxwf-cmd',
    );
    expect(cmdResult?.outputItems?.[0]?.[0]?.json.exitCode).toBe(0);
  });

  test('debug-node fails executeCommand when command is empty', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Execute Command empty E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'cmd1',
          type: 'executeCommand',
          name: 'Run',
          position: { x: 240, y: 0 },
          parameters: { command: '   ', args: ['x'] },
        },
      ],
      connections: [{ from: 't1', to: 'cmd1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugExecuteCommandNode(request, workflowId, definition, 'cmd1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.cmd1?.status).toBe('failed');
    expect(result.nodeResults?.cmd1?.errorCode).toBe('E2002');
  });
});
