/**
 * Migrate Lite SQLite (RXWF_DATA_DIR/rxwf.db) → PostgreSQL (RXWF_DATABASE_URL).
 * Usage: node scripts/rxwf-migrate.mjs [--dry-run]
 */
import Database from 'better-sqlite3';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const dataDir = process.env.RXWF_DATA_DIR ?? join(repoRoot, 'data');
const sqlitePath = join(dataDir, 'rxwf.db');
const pgUrl =
  process.env.RXWF_DATABASE_URL ??
  process.env.RXWF_POSTGRES_URL ??
  'postgres://rxwf:rxwf@localhost:5432/rxwf';

const { applyPgSchema } = await import(
  new URL('../packages/providers/standard/dist/drizzle/apply-schema.js', import.meta.url)
).catch(async () => {
  console.error(
    '请先构建 standard 包: pnpm --filter @rxwf/providers-standard build',
  );
  process.exit(1);
});

function ts(value) {
  if (value == null) return new Date();
  if (value instanceof Date) return value;
  const n = Number(value);
  return Number.isFinite(n) ? new Date(n) : new Date(String(value));
}

async function upsert(client, table, columns, rows, conflict) {
  if (rows.length === 0) return 0;
  let count = 0;
  for (const row of rows) {
    const cols = columns.filter((c) => row[c] !== undefined);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const values = cols.map((c) => row[c]);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT ${conflict} DO NOTHING`;
    if (dryRun) {
      count++;
      continue;
    }
    await client.query(sql, values);
    count++;
  }
  return count;
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  let sqlite;
  try {
    sqlite = new Database(sqlitePath, { readonly: true });
  } catch (err) {
    console.error(`无法打开 SQLite: ${sqlitePath}`, err.message);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: pgUrl });
  if (!dryRun) {
    await applyPgSchema(pool);
  }

  const client = await pool.connect();
  const summary = {};

  try {
    const users = sqlite
      .prepare(
        'SELECT id, email, password_hash, role, created_at FROM users',
      )
      .all();
    summary.users = await upsert(
      client,
      'users',
      ['id', 'email', 'password_hash', 'role', 'created_at'],
      users.map((u) => ({
        id: u.id,
        email: u.email,
        password_hash: u.password_hash,
        role: u.role,
        created_at: ts(u.created_at),
      })),
      '(id) DO NOTHING',
    );

    const workflows = sqlite
      .prepare(
        'SELECT id, name, status, created_at, updated_at FROM workflows',
      )
      .all();
    summary.workflows = await upsert(
      client,
      'workflows',
      ['id', 'name', 'status', 'created_at', 'updated_at'],
      workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        created_at: ts(w.created_at),
        updated_at: ts(w.updated_at),
      })),
      '(id) DO NOTHING',
    );

    const versions = sqlite
      .prepare(
        'SELECT id, workflow_id, version, definition, created_at FROM workflow_versions',
      )
      .all();
    summary.workflow_versions = await upsert(
      client,
      'workflow_versions',
      ['id', 'workflow_id', 'version', 'definition', 'created_at'],
      versions.map((v) => ({
        id: v.id,
        workflow_id: v.workflow_id,
        version: v.version,
        definition: v.definition,
        created_at: ts(v.created_at),
      })),
      '(id) DO NOTHING',
    );

    const credentials = sqlite
      .prepare(
        'SELECT id, name, type, encrypted_payload, created_at, updated_at FROM credentials',
      )
      .all();
    summary.credentials = await upsert(
      client,
      'credentials',
      ['id', 'name', 'type', 'encrypted_payload', 'created_at', 'updated_at'],
      credentials.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        encrypted_payload: c.encrypted_payload,
        created_at: ts(c.created_at),
        updated_at: ts(c.updated_at),
      })),
      '(id) DO NOTHING',
    );

    const envVars = sqlite
      .prepare(
        `SELECT id, scope, scope_id, environment, key, value_encrypted, created_at, updated_at
         FROM env_vars`,
      )
      .all();
    summary.env_vars = await upsert(
      client,
      'env_vars',
      [
        'id',
        'scope',
        'scope_id',
        'environment',
        'key',
        'value_encrypted',
        'created_at',
        'updated_at',
      ],
      envVars.map((e) => ({
        id: e.id,
        scope: e.scope,
        scope_id: e.scope_id,
        environment: e.environment,
        key: e.key,
        value_encrypted: e.value_encrypted,
        created_at: ts(e.created_at),
        updated_at: ts(e.updated_at),
      })),
      '(id) DO NOTHING',
    );

    if (process.argv.includes('--with-executions')) {
      const executions = sqlite
        .prepare(
          `SELECT id, trace_id, workflow_id, workflow_version_id, definition_snapshot,
                  status, mode, environment, idempotency_key, started_at, finished_at, created_at
           FROM executions`,
        )
        .all();
      summary.executions = await upsert(
        client,
        'executions',
        [
          'id',
          'trace_id',
          'workflow_id',
          'workflow_version_id',
          'definition_snapshot',
          'status',
          'mode',
          'environment',
          'idempotency_key',
          'started_at',
          'finished_at',
          'created_at',
        ],
        executions.map((e) => ({
          id: e.id,
          trace_id: e.trace_id,
          workflow_id: e.workflow_id,
          workflow_version_id: e.workflow_version_id,
          definition_snapshot: e.definition_snapshot,
          status: e.status,
          mode: e.mode,
          environment: e.environment,
          idempotency_key: e.idempotency_key ?? null,
          started_at: e.started_at ? ts(e.started_at) : null,
          finished_at: e.finished_at ? ts(e.finished_at) : null,
          created_at: ts(e.created_at),
        })),
        '(id) DO NOTHING',
      );
    }
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }

  console.log(
    dryRun ? '[dry-run] 将迁移:' : '已迁移:',
    JSON.stringify(summary, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
