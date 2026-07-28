import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerPlusExecutors } from './register-plus.js';
import { createPostgresExecutor } from './postgres.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const postgresAuditRowPath = join(repoRoot, 'docs/test/node-audit-rows/postgres.md');

const pgQuery = vi.fn();
const pgEnd = vi.fn().mockResolvedValue(undefined);

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      query: pgQuery,
      end: pgEnd,
    })),
  },
}));

describe('postgres registry', () => {
  it('throws E2003 when postgres executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('postgres', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('postgres')).toBe(true);
  });
});

describe('postgres M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(postgresAuditRowPath)).toBe(true);
    const content = readFileSync(postgresAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-postgres');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-postgres');
  });
});

describe('createPostgresExecutor', () => {
  afterEach(() => {
    pgQuery.mockReset();
    pgEnd.mockClear();
    delete process.env.RXWF_DATABASE_URL;
  });

  it('runs SQL and returns rows per input item', async () => {
    pgQuery.mockResolvedValue({ rows: [{ n: 42 }], rowCount: 1 });
    process.env.RXWF_DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/rxwf';

    const executor = createPostgresExecutor();
    const result = await executor.execute({
      config: { query: 'SELECT 42 AS n' },
      inputItems: [{ json: {} }, { json: { id: 2 } }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json.rows).toEqual([{ n: 42 }]);
    expect(result.outputItems?.[0]?.[0]?.json.rowCount).toBe(1);
    expect(result.outputItems?.[0]?.[0]?.json.query).toBe('SELECT 42 AS n');
    expect(pgQuery).toHaveBeenCalledTimes(2);
    expect(pgEnd).toHaveBeenCalledTimes(1);
  });

  it('defaults query to SELECT 1 when omitted', async () => {
    pgQuery.mockResolvedValue({ rows: [{ ok: 1 }], rowCount: 1 });
    process.env.RXWF_DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/rxwf';

    const executor = createPostgresExecutor();
    const result = await executor.execute({
      config: {},
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    expect(pgQuery).toHaveBeenCalledWith('SELECT 1');
    expect(result.outputItems?.[0]?.[0]?.json.query).toBe('SELECT 1');
  });

  it('uses deps.databaseUrl over environment variable', async () => {
    pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    process.env.RXWF_DATABASE_URL = 'postgres://ignored:ignored@127.0.0.1:5432/x';

    const executor = createPostgresExecutor({
      databaseUrl: 'postgres://u:p@127.0.0.1:5432/rxwf',
    });
    await executor.execute({
      config: { query: 'SELECT 1' },
      inputItems: [{ json: {} }],
    });

    const { default: pg } = await import('pg');
    expect(pg.Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgres://u:p@127.0.0.1:5432/rxwf',
      }),
    );
  });

  it('fails with E2003 when no connection URL is configured', async () => {
    const executor = createPostgresExecutor();
    const result = await executor.execute({
      config: { query: 'SELECT 1' },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2003');
    expect(result.errorMessage).toMatch(/connection/i);
    expect(pgQuery).not.toHaveBeenCalled();
  });

  it('fails with E2002 when query is empty', async () => {
    process.env.RXWF_DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/rxwf';
    const executor = createPostgresExecutor();
    const result = await executor.execute({
      config: { query: '   ' },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(pgQuery).not.toHaveBeenCalled();
  });

  it('fails when SQL execution throws', async () => {
    pgQuery.mockRejectedValue(new Error('relation "missing" does not exist'));
    process.env.RXWF_DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/rxwf';

    const executor = createPostgresExecutor();
    const result = await executor.execute({
      config: { query: 'SELECT * FROM missing' },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('missing');
    expect(pgEnd).toHaveBeenCalledTimes(1);
  });
});
