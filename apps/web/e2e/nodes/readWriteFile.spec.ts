import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-readWriteFile — readWriteFile 执行与面板 (M-3 / plus) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/readWriteFile.md');
const SPEC_FILE = 'nodes/readWriteFile.spec.ts';

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

function e2eTempFilePath(suffix: string): string {
  return path.join(tmpdir(), `rxwf-e2e-rw-${Date.now()}-${suffix}`);
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

async function debugReadWriteFileNode(
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

test.describe('readWriteFile audit row @any', () => {
  test('AUDIT-N-readWriteFile row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('readWriteFile E2E-N-readWriteFile @plus @any', () => {
  test.describe.configure({ mode: 'serial' });

  test('Read/Write File panel shows operation and path fields', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Read/Write File panel E2E',
      nodes: [
        {
          id: 'rw1',
          type: 'readWriteFile',
          name: 'File',
          position: { x: 0, y: 0 },
          parameters: { operation: 'write', path: e2eTempFilePath('panel.txt'), content: 'x' },
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
      .filter({ hasText: /^File$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '操作' })).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: '路径' })).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: '内容（可选）' }),
    ).toBeVisible();
    await expect(
      modal.locator('.rxwf-form-field-label', { hasText: 'Binary 属性名' }),
    ).toBeVisible();
  });

  test('debug-node writes then reads file content', async ({ request }) => {
    const filePath = e2eTempFilePath('roundtrip.txt');
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Read/Write File write-read E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rw1',
          type: 'readWriteFile',
          name: 'File',
          position: { x: 240, y: 0 },
          parameters: {
            operation: 'write',
            path: filePath,
            content: 'e2e-rxwf-rw',
          },
        },
      ],
      connections: [{ from: 't1', to: 'rw1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const writeResult = await debugReadWriteFileNode(request, workflowId, definition, 'rw1');

    expect(writeResult.status).toBe('success');
    const writeNode = writeResult.nodeResults?.rw1;
    expect(writeNode?.status).toBe('success');
    expect(writeNode?.outputItems?.[0]?.[0]?.json.bytesWritten).toBeGreaterThan(0);

    const readDefinition: WorkflowDefinition = {
      ...definition,
      nodes: definition.nodes.map((node) =>
        node.id === 'rw1'
          ? { ...node, parameters: { operation: 'read', path: filePath } }
          : node,
      ),
    };

    const readResult = await debugReadWriteFileNode(
      request,
      workflowId,
      readDefinition,
      'rw1',
    );

    expect(readResult.status).toBe('success');
    const readNode = readResult.nodeResults?.rw1;
    expect(readNode?.status).toBe('success');
    expect(readNode?.outputItems?.[0]?.[0]?.json.content).toBe('e2e-rxwf-rw');
  });

  test('debug-node fails readWriteFile when path is empty', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Read/Write File empty path E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'rw1',
          type: 'readWriteFile',
          name: 'File',
          position: { x: 240, y: 0 },
          parameters: { operation: 'read', path: '   ' },
        },
      ],
      connections: [{ from: 't1', to: 'rw1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugReadWriteFileNode(request, workflowId, definition, 'rw1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.rw1?.status).toBe('failed');
    expect(result.nodeResults?.rw1?.errorCode).toBe('E2002');
  });
});
