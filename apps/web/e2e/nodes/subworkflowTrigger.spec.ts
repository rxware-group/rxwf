import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-subworkflowTrigger — subworkflowTrigger 执行与面板 (M-3 / plus matrix, @any verify) */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/subworkflowTrigger.md');
const SPEC_FILE = 'nodes/subworkflowTrigger.spec.ts';

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
  const uniqueDefinition = {
    ...definition,
    name: `${definition.name} ${Date.now()}`,
  };
  const res = await request.post('/api/workflows', {
    data: { name: uniqueDefinition.name, definition: uniqueDefinition },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return { workflowId: body.id, definition: uniqueDefinition };
}

async function debugSubworkflowTrigger(
  request: import('@playwright/test').APIRequestContext,
  workflowId: string,
  definition: WorkflowDefinition,
  targetNodeId: string,
  pinData?: Record<string, Array<{ json: Record<string, unknown> }>>,
): Promise<DebugNodeResponse> {
  const res = await request.post('/api/workflows/debug-node', {
    data: {
      workflowId,
      definition,
      targetNodeId,
      pinData,
      environment: 'test',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as DebugNodeResponse;
}

test.describe('subworkflowTrigger audit row @any', () => {
  test('AUDIT-N-subworkflowTrigger row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('subworkflowTrigger E2E-N-subworkflowTrigger @any', () => {
  test('panel shows input mode, debug-node executes, pinned output feeds downstream', async ({
    page,
  }) => {
    const request = page.request;
    const soloDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Subworkflow trigger E2E',
      nodes: [
        {
          id: 'st1',
          type: 'subworkflowTrigger',
          name: 'Sub Trigger',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll', inputs: [], jsonExample: {} },
        },
      ],
      connections: [],
    };

    const { workflowId, definition: savedSolo } = await createWorkflow(request, soloDefinition);
    await page.goto(`/workflows/${workflowId}`);

    const canvas = page.locator('.react-flow');
    await expect(canvas).toBeVisible();
    await canvas
      .locator('.workflow-node-caption-title')
      .filter({ hasText: /^Sub Trigger$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('入参模式', { exact: true })).toBeVisible();
    await expect(modal.locator('.subworkflow-trigger-fields')).toBeVisible();

    const soloResult = await debugSubworkflowTrigger(request, workflowId, savedSolo, 'st1');
    expect(soloResult.status).toBe('success');
    expect(soloResult.nodeResults?.st1?.status).toBe('success');
    expect(soloResult.nodeResults?.st1?.outputItems?.[0]).toEqual([{ json: {} }]);

    const chainDefinition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Subworkflow trigger chain E2E',
      nodes: [
        {
          id: 'st1',
          type: 'subworkflowTrigger',
          name: 'Sub Trigger',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll' },
        },
        {
          id: 's1',
          type: 'set',
          name: 'Echo',
          position: { x: 220, y: 0 },
          parameters: { mode: 'expression', fields: { echoed: '{{ $json.orderId }}' } },
        },
      ],
      connections: [{ from: 'st1', to: 's1' }],
    };

    const { workflowId: chainId, definition: savedChain } = await createWorkflow(
      request,
      chainDefinition,
    );
    const chainResult = await debugSubworkflowTrigger(request, chainId, savedChain, 's1', {
      st1: [{ json: { orderId: 'e2e-99' } }],
    });

    expect(chainResult.status).toBe('success');
    expect(chainResult.nodeResults?.s1?.status).toBe('success');
    expect(chainResult.nodeResults?.s1?.outputItems?.[0]?.[0]?.json).toMatchObject({
      echoed: 'e2e-99',
    });
  });
});
