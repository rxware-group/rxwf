import type { Pool } from 'pg';

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version INTEGER NOT NULL,
  definition TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  definition_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  environment TEXT NOT NULL,
  idempotency_key TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS node_runs (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  input_ref TEXT,
  output_ref TEXT,
  error_code TEXT,
  duration_ms INTEGER,
  runner_id TEXT,
  runner_platform TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  data_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS env_vars (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS env_vars_scope_key ON env_vars (scope, scope_id, environment, key);

CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS variables_scope_key ON variables (scope, scope_id, environment, key);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  theme_preference TEXT NOT NULL DEFAULT 'system',
  theme_id TEXT NOT NULL DEFAULT 'dark',
  execution_environment TEXT NOT NULL DEFAULT 'test',
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, scope)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  lease_owner TEXT,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  execution_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_session_messages_session_id ON agent_session_messages(session_id);
`;

const MIGRATIONS = `
ALTER TABLE executions ADD COLUMN IF NOT EXISTS session_id TEXT;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  embedding_model TEXT NOT NULL DEFAULT 'nomic-embed-text',
  chunk_size INTEGER NOT NULL DEFAULT 1000,
  chunk_overlap INTEGER NOT NULL DEFAULT 200,
  top_k INTEGER NOT NULL DEFAULT 5,
  similarity_threshold INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding vector(768),
  embedding_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_kb_id ON knowledge_chunks(knowledge_base_id);

ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS hybrid_search BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS knowledge_sync_sources (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  config_json TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_bots (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  published_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_bot_versions (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES chat_bots(id),
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_bot_channels (
  bot_id TEXT NOT NULL REFERENCES chat_bots(id),
  channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (bot_id, channel)
);

CREATE TABLE IF NOT EXISTS chat_bot_api_keys (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES chat_bots(id),
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_bot_publish_log (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL REFERENCES chat_bots(id),
  version_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'user',
  bot_id TEXT REFERENCES chat_bots(id),
  bot_version_id TEXT REFERENCES chat_bot_versions(id),
  public_client_token TEXT,
  mode TEXT NOT NULL DEFAULT 'chat',
  knowledge_base_ids TEXT NOT NULL DEFAULT '[]',
  rag_template TEXT NOT NULL DEFAULT 'support',
  system_prompt TEXT NOT NULL DEFAULT '',
  model_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS model_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT NOT NULL,
  credential_id TEXT REFERENCES credentials(id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_health_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES model_providers(id),
  model_name TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '["chat"]',
  is_default_chat BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS models_provider_id_model_name ON models (provider_id, model_name);
`;

const USER_RBAC_MIGRATIONS = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS join_method TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_invite_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  invited_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS workflow_collaborators (
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workflow_id, user_id)
);

ALTER TABLE workflow_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE workflow_versions ADD COLUMN IF NOT EXISTS published_by_user_id TEXT REFERENCES users(id);
ALTER TABLE workflow_versions ADD COLUMN IF NOT EXISTS publish_note TEXT;

CREATE TABLE IF NOT EXISTS workflow_publish_log (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);
`;

export async function applyPgSchema(pool: Pool): Promise<void> {
  await pool.query(DDL);
  await pool.query(MIGRATIONS);
  await pool.query(USER_RBAC_MIGRATIONS);
  await backfillWorkflowCreatedBy(pool);
  await pool.query("UPDATE user_preferences SET locale = 'en-US' WHERE locale = 'en'");
  await migrateWorkflowVersionsDraftPublished(pool);
}

async function backfillWorkflowCreatedBy(pool: Pool): Promise<void> {
  const admin = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1",
  );
  const adminId = admin.rows[0]?.id;
  if (adminId) {
    await pool.query(
      "UPDATE workflows SET created_by_user_id = $1 WHERE created_by_user_id IS NULL",
      [adminId],
    );
  }
}

async function migrateWorkflowVersionsDraftPublished(pool: Pool): Promise<void> {
  const already = await pool.query(`SELECT 1 FROM workflow_versions WHERE published_at IS NOT NULL LIMIT 1`);
  if (already.rowCount && already.rowCount > 0) return;

  const workflows = await pool.query<{
    id: string;
    published_version_id: string | null;
    published_at: Date | null;
    created_by_user_id: string | null;
  }>(`SELECT id, published_version_id, published_at, created_by_user_id FROM workflows`);

  for (const wf of workflows.rows) {
    const versions = await pool.query<{
      id: string;
      version: number;
      definition: string;
      semver_label: string;
      created_at: Date;
    }>(
      `SELECT id, version, definition, semver_label, created_at FROM workflow_versions
       WHERE workflow_id = $1 ORDER BY version ASC`,
      [wf.id],
    );
    if (versions.rows.length === 0) continue;

    const latest = versions.rows[versions.rows.length - 1]!;
    const publishedId = wf.published_version_id;
    const refs = await pool.query<{ workflow_version_id: string }>(
      `SELECT DISTINCT workflow_version_id FROM executions WHERE workflow_id = $1`,
      [wf.id],
    );
    const refIds = new Set(refs.rows.map((r) => r.workflow_version_id));

    if (publishedId) {
      const pubAt = wf.published_at ?? latest.created_at;
      await pool.query(
        `UPDATE workflow_versions SET published_at = $1, published_by_user_id = $2 WHERE id = $3`,
        [pubAt, wf.created_by_user_id, publishedId],
      );
    }

    let draftId = latest.id;
    if (publishedId && latest.id === publishedId) {
      draftId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO workflow_versions (id, workflow_id, version, definition, semver_label, change_note, created_at, published_at)
         VALUES ($1, $2, 0, $3, $4, NULL, NOW(), NULL)`,
        [draftId, wf.id, latest.definition, latest.semver_label ?? '1.0.0'],
      );
    } else {
      await pool.query(`UPDATE workflow_versions SET published_at = NULL, version = 0 WHERE id = $1`, [
        latest.id,
      ]);
    }

    for (const v of versions.rows) {
      if (v.id === draftId) continue;
      if (v.id === publishedId) continue;
      if (refIds.has(v.id)) continue;
      await pool.query(`DELETE FROM workflow_versions WHERE id = $1`, [v.id]);
    }
  }
}
