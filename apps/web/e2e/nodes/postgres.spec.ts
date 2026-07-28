import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/** E2E-N-postgres — postgres 执行与面板 (M-3 / standard) */

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eDir, '../../../..');
const auditRowPath = path.join(repoRoot, 'docs/test/node-audit-rows/postgres.md');
const SPEC_FILE = 'nodes/postgres.spec.ts';

/** Playwright webServer does not load `.e2e-env`; resolve URL from file or compose defaults. */
function resolveE2ePostgresUrl(): string {
  if (process.env.RXWF_DATABASE_URL?.trim()) {
    return process.env.RXWF_DATABASE_URL.trim();
  }
  try {
    const content = readFileSync(path.join(e2eDir, '.e2e-env'), 'utf8');
    const match = content.match(/^RXWF_DATABASE_URL=(.+)$/m);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  } catch {
    /* .e2e-env optional when env is injected directly */
  }
  const user = process.env.RXWF_POSTGRES_USER ?? 'rxwf';
  const password = process.env.RXWF_POSTGRES_PASSWORD ?? 'e2e-test-pass';
  const db = process.env.RXWF_POSTGRES_DB ?? 'rxwf';
  return `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:5432/${db}`;
}

function postgresNodeParameters(query: string): Record<string, unknown> {
  return {
    query,
    connectionString: resolveE2ePostgresUrl(),
  };
}

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

async function debugPostgresNode(
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

test.describe('postgres audit row', () => {
  test('AUDIT-N-postgres row documents ok conclusions', () => {
    expect(readAuditRowField('panel')).toBe('ok');
    expect(readAuditRowField('validation')).toBe('ok');
    expect(readAuditRowField('executor')).toBe('ok');
    expect(readAuditRowField('status')).toBe('ok');
    expect(readAuditRowField('e2e_spec')).toBe(SPEC_FILE);
  });
});

test.describe('postgres E2E-N-postgres @any', () => {
  test('Postgres panel shows SQL query field', async ({ page, request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Postgres panel E2E',
      nodes: [
        {
          id: 'pg1',
          type: 'postgres',
          name: 'Query',
          position: { x: 0, y: 0 },
          parameters: { query: 'SELECT 1 AS ok' },
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
      .filter({ hasText: /^Query$/ })
      .dblclick();

    const modal = page.locator('.node-editor-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.rxwf-form-field-label', { hasText: 'SQL' })).toBeVisible();
    await expect(modal.locator('textarea')).toHaveValue('SELECT 1 AS ok');
  });

  test('debug-node runs postgres SELECT and returns rows', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Postgres E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'pg1',
          type: 'postgres',
          name: 'Query',
          position: { x: 240, y: 0 },
          parameters: postgresNodeParameters('SELECT 1 AS ok'),
        },
      ],
      connections: [{ from: 't1', to: 'pg1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugPostgresNode(request, workflowId, definition, 'pg1');

    expect(result.status).toBe('success');
    const pgResult = result.nodeResults?.pg1;
    expect(pgResult?.status).toBe('success');
    const rows = pgResult?.outputItems?.[0]?.[0]?.json.rows as Array<{ ok: number }> | undefined;
    expect(rows?.[0]?.ok).toBe(1);
    expect(pgResult?.outputItems?.[0]?.[0]?.json.query).toBe('SELECT 1 AS ok');
  });

  test('debug-node fails postgres when query is blank', async ({ request }) => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'Postgres blank query E2E',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'pg1',
          type: 'postgres',
          name: 'Query',
          position: { x: 240, y: 0 },
          parameters: postgresNodeParameters('   '),
        },
      ],
      connections: [{ from: 't1', to: 'pg1' }],
    };

    const workflowId = await createWorkflow(request, definition);
    const result = await debugPostgresNode(request, workflowId, definition, 'pg1');

    expect(result.status).toBe('failed');
    expect(result.nodeResults?.pg1?.status).toBe('failed');
    expect(result.nodeResults?.pg1?.errorCode).toBe('E2002');
  });
});
