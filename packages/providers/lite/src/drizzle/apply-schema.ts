import type Database from "better-sqlite3";

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  version INTEGER NOT NULL,
  definition TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY NOT NULL,
  trace_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  definition_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  environment TEXT NOT NULL,
  idempotency_key TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runners (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  platform_os TEXT NOT NULL,
  platform_arch TEXT NOT NULL,
  platform_version TEXT,
  labels TEXT NOT NULL DEFAULT '[]',
  capabilities TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  max_concurrent INTEGER NOT NULL DEFAULT 10,
  running_jobs INTEGER NOT NULL DEFAULT 0,
  agent_version TEXT,
  last_heartbeat_at INTEGER,
  credential_hash TEXT NOT NULL DEFAULT '',
  registered_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS node_runs (
  id TEXT PRIMARY KEY NOT NULL,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  input_ref TEXT,
  output_ref TEXT,
  error_code TEXT,
  duration_ms INTEGER,
  runner_id TEXT REFERENCES runners(id),
  runner_platform TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_blobs (
  id TEXT PRIMARY KEY NOT NULL,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  node_run_id TEXT REFERENCES node_runs(id),
  kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  scope TEXT NOT NULL,
  execution_id TEXT NOT NULL REFERENCES executions(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_scope ON idempotency_keys (key, scope);

CREATE TABLE IF NOT EXISTS scheduler_leases (
  id TEXT PRIMARY KEY NOT NULL,
  holder TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  lease_owner TEXT,
  lease_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  data_encrypted TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS env_vars (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS env_vars_scope_key ON env_vars (scope, scope_id, environment, key);

CREATE TABLE IF NOT EXISTS variables (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS variables_scope_key ON variables (scope, scope_id, environment, key);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  theme_preference TEXT NOT NULL DEFAULT 'system',
  theme_id TEXT NOT NULL DEFAULT 'dark',
  execution_environment TEXT NOT NULL DEFAULT 'test',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS agent_session_messages (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  execution_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_session_messages_session_id ON agent_session_messages(session_id);
`;

/** @internal Exported for migration tests */
export function migrateChatBotsSchemaForTest(sqlite: Database.Database): void {
  migrateChatBotsSchema(sqlite);
}

export function applySchema(sqlite: Database.Database): void {
  sqlite.exec(DDL);
  const columns = sqlite
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!columns.some((c) => c.name === "role")) {
    sqlite.exec(
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'",
    );
  }

  const workflowCols = sqlite
    .prepare("PRAGMA table_info(workflows)")
    .all() as { name: string }[];
  if (!workflowCols.some((c) => c.name === "published_version_id")) {
    sqlite.exec(
      "ALTER TABLE workflows ADD COLUMN published_version_id TEXT",
    );
  }
  if (!workflowCols.some((c) => c.name === "published_at")) {
    sqlite.exec("ALTER TABLE workflows ADD COLUMN published_at INTEGER");
  }

  const versionCols = sqlite
    .prepare("PRAGMA table_info(workflow_versions)")
    .all() as { name: string }[];
  if (!versionCols.some((c) => c.name === "semver_label")) {
    sqlite.exec(
      "ALTER TABLE workflow_versions ADD COLUMN semver_label TEXT NOT NULL DEFAULT '1.0.0'",
    );
  }
  if (!versionCols.some((c) => c.name === "change_note")) {
    sqlite.exec("ALTER TABLE workflow_versions ADD COLUMN change_note TEXT");
  }
  if (!versionCols.some((c) => c.name === "published_at")) {
    sqlite.exec("ALTER TABLE workflow_versions ADD COLUMN published_at INTEGER");
  }
  if (!versionCols.some((c) => c.name === "published_by_user_id")) {
    sqlite.exec(
      "ALTER TABLE workflow_versions ADD COLUMN published_by_user_id TEXT REFERENCES users(id)",
    );
  }
  if (!versionCols.some((c) => c.name === "publish_note")) {
    sqlite.exec("ALTER TABLE workflow_versions ADD COLUMN publish_note TEXT");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_publish_log (
      id TEXT PRIMARY KEY NOT NULL,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      version_id TEXT,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  const nodeRunCols = sqlite
    .prepare("PRAGMA table_info(node_runs)")
    .all() as { name: string }[];
  if (!nodeRunCols.some((c) => c.name === "output_data")) {
    sqlite.exec("ALTER TABLE node_runs ADD COLUMN output_data TEXT");
  }
  if (!nodeRunCols.some((c) => c.name === "metadata")) {
    sqlite.exec("ALTER TABLE node_runs ADD COLUMN metadata TEXT");
  }

  const executionCols = sqlite
    .prepare("PRAGMA table_info(executions)")
    .all() as { name: string }[];
  if (!executionCols.some((c) => c.name === "session_id")) {
    sqlite.exec("ALTER TABLE executions ADD COLUMN session_id TEXT");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_session_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      execution_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS agent_session_messages_session_id
    ON agent_session_messages(session_id);
  `);

  sqlite.exec(`
    UPDATE workflows SET status = 'published' WHERE status = 'active';
  `);
  sqlite.exec(`
    UPDATE workflows
    SET published_version_id = (
      SELECT wv.id FROM workflow_versions wv
      WHERE wv.workflow_id = workflows.id
      ORDER BY wv.version DESC LIMIT 1
    )
    WHERE status = 'published' AND published_version_id IS NULL;
  `);
  sqlite.exec(
    `UPDATE env_vars SET environment = 'test' WHERE environment IN ('dev', 'staging');`,
  );
  sqlite.exec(
    `UPDATE user_preferences SET execution_environment = 'test' WHERE execution_environment IN ('dev', 'staging');`,
  );

  const chatSessionCols = sqlite
    .prepare("PRAGMA table_info(chat_sessions)")
    .all() as { name: string }[];
  if (!chatSessionCols.some((c) => c.name === "mode")) {
    sqlite.exec(
      "ALTER TABLE chat_sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat'",
    );
  }
  if (!chatSessionCols.some((c) => c.name === "knowledge_base_ids")) {
    sqlite.exec(
      "ALTER TABLE chat_sessions ADD COLUMN knowledge_base_ids TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!chatSessionCols.some((c) => c.name === "rag_template")) {
    sqlite.exec(
      "ALTER TABLE chat_sessions ADD COLUMN rag_template TEXT NOT NULL DEFAULT 'support'",
    );
  }

  const chatMsgCols = sqlite
    .prepare("PRAGMA table_info(chat_messages)")
    .all() as { name: string }[];
  if (!chatMsgCols.some((c) => c.name === "citations")) {
    sqlite.exec("ALTER TABLE chat_messages ADD COLUMN citations TEXT");
  }
  if (!chatMsgCols.some((c) => c.name === "feedback")) {
    sqlite.exec("ALTER TABLE chat_messages ADD COLUMN feedback TEXT");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      embedding_model TEXT NOT NULL DEFAULT 'nomic-embed-text',
      chunk_size INTEGER NOT NULL DEFAULT 1000,
      chunk_overlap INTEGER NOT NULL DEFAULT 200,
      top_k INTEGER NOT NULL DEFAULT 5,
      similarity_threshold INTEGER NOT NULL DEFAULT 50,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY NOT NULL,
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id),
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY NOT NULL,
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id),
      document_id TEXT NOT NULL REFERENCES knowledge_documents(id),
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS knowledge_chunks_kb_id ON knowledge_chunks(knowledge_base_id);
  `);

  const kbCols = sqlite
    .prepare("PRAGMA table_info(knowledge_bases)")
    .all() as { name: string }[];
  if (!kbCols.some((c) => c.name === "hybrid_search")) {
    sqlite.exec(
      "ALTER TABLE knowledge_bases ADD COLUMN hybrid_search INTEGER NOT NULL DEFAULT 0",
    );
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_collaborators (
      knowledge_base_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (knowledge_base_id, user_id)
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_sync_sources (
      id TEXT PRIMARY KEY NOT NULL,
      knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id),
      kind TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_sync_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      source_format TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      status TEXT NOT NULL DEFAULT 'active',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS skill_files (
      skill_id TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT,
      content_hash TEXT NOT NULL,
      PRIMARY KEY (skill_id, path)
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS skill_scan_roots (
      id TEXT PRIMARY KEY NOT NULL,
      runner_id TEXT,
      root_path TEXT NOT NULL,
      last_scan_at INTEGER,
      skills_found INTEGER NOT NULL DEFAULT 0
    );
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS instruction_contexts (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL,
      source_format TEXT NOT NULL,
      file_path TEXT NOT NULL,
      root_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      paths_json TEXT,
      load_phase TEXT NOT NULL DEFAULT 'always',
      token_estimate INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      last_scanned_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS instruction_contexts_root_file_hash
      ON instruction_contexts (root_path, file_path, content_hash);
  `);

  migrateChatBotsSchema(sqlite);

  const sessionCols = sqlite
    .prepare("PRAGMA table_info(chat_sessions)")
    .all() as { name: string }[];
  if (!sessionCols.some((c) => c.name === "system_prompt")) {
    sqlite.exec(
      "ALTER TABLE chat_sessions ADD COLUMN system_prompt TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!sessionCols.some((c) => c.name === "model_id")) {
    sqlite.exec("ALTER TABLE chat_sessions ADD COLUMN model_id TEXT");
  }
  if (!sessionCols.some((c) => c.name === "deleted_at")) {
    sqlite.exec("ALTER TABLE chat_sessions ADD COLUMN deleted_at INTEGER");
  }
  if (!sessionCols.some((c) => c.name === "kind")) {
    sqlite.exec(
      "ALTER TABLE chat_sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'user'",
    );
  }
  if (!sessionCols.some((c) => c.name === "bot_id")) {
    sqlite.exec("ALTER TABLE chat_sessions ADD COLUMN bot_id TEXT");
  }
  if (!sessionCols.some((c) => c.name === "bot_version_id")) {
    sqlite.exec("ALTER TABLE chat_sessions ADD COLUMN bot_version_id TEXT");
  }
  if (!sessionCols.some((c) => c.name === "public_client_token")) {
    sqlite.exec("ALTER TABLE chat_sessions ADD COLUMN public_client_token TEXT");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS model_providers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_url TEXT NOT NULL,
      credential_id TEXT REFERENCES credentials(id),
      enabled INTEGER NOT NULL DEFAULT 1,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL REFERENCES model_providers(id),
      model_name TEXT NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '["chat"]',
      is_default_chat INTEGER NOT NULL DEFAULT 0,
      is_default_workflow INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(provider_id, model_name)
    );
  `);

  migrateModelsDefaultWorkflow(sqlite);

  migrateWorkflowDescription(sqlite);
  migrateUserProfile(sqlite);
  migrateLocaleEnToEnUs(sqlite);
  migrateUserRbacSchema(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS runner_registration_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_by TEXT REFERENCES users(id),
      labels_default TEXT NOT NULL DEFAULT '[]',
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
}

function migrateModelsDefaultWorkflow(sqlite: Database.Database): void {
  const cols = sqlite
    .prepare("PRAGMA table_info(models)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_default_workflow")) {
    sqlite.exec(
      "ALTER TABLE models ADD COLUMN is_default_workflow INTEGER NOT NULL DEFAULT 0",
    );
  }
}

function migrateLocaleEnToEnUs(sqlite: Database.Database): void {
  sqlite.exec("UPDATE user_preferences SET locale = 'en-US' WHERE locale = 'en'");
}

function migrateUserProfile(sqlite: Database.Database): void {
  const userCols = sqlite
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!userCols.some((c) => c.name === "nickname")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  }
  if (!userCols.some((c) => c.name === "avatar_url")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
}

function migrateWorkflowDescription(sqlite: Database.Database): void {
  const workflowCols = sqlite
    .prepare("PRAGMA table_info(workflows)")
    .all() as { name: string }[];
  if (!workflowCols.some((c) => c.name === "description")) {
    sqlite.exec(
      "ALTER TABLE workflows ADD COLUMN description TEXT NOT NULL DEFAULT ''",
    );
  }
}

function migrateUserRbacSchema(sqlite: Database.Database): void {
  const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const names = new Set(userCols.map((c) => c.name));
  if (!names.has("status")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!names.has("join_method")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN join_method TEXT");
  }
  if (!names.has("must_change_password")) {
    sqlite.exec(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!names.has("last_login_at")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN last_login_at INTEGER");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_invite_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      invited_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  const wfCols = sqlite.prepare("PRAGMA table_info(workflows)").all() as Array<{ name: string }>;
  if (!wfCols.some((c) => c.name === "created_by_user_id")) {
    sqlite.exec("ALTER TABLE workflows ADD COLUMN created_by_user_id TEXT REFERENCES users(id)");
    const admin = sqlite
      .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined;
    if (admin) {
      sqlite
        .prepare("UPDATE workflows SET created_by_user_id = ? WHERE created_by_user_id IS NULL")
        .run(admin.id);
    }
  }

  migrateWorkflowVersionsDraftPublished(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_collaborators (
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workflow_id, user_id)
    );
  `);
}

function migrateChatBotsSchema(sqlite: Database.Database): void {
  const botCols = sqlite.prepare("PRAGMA table_info(chat_bots)").all() as { name: string }[];
  const hasBotsTable = botCols.length > 0;
  const isLegacy = botCols.some((c) => c.name === "system_prompt");
  let migrateLegacyRows = false;

  if (!hasBotsTable) {
    sqlite.exec(`
      CREATE TABLE chat_bots (
        id TEXT PRIMARY KEY NOT NULL,
        owner_user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'draft',
        published_version_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  } else if (isLegacy) {
    if (!botCols.some((c) => c.name === "owner_user_id")) {
      sqlite.exec(
        "ALTER TABLE chat_bots ADD COLUMN owner_user_id TEXT REFERENCES users(id)",
      );
      sqlite.exec("UPDATE chat_bots SET owner_user_id = user_id WHERE owner_user_id IS NULL");
    }
    if (!botCols.some((c) => c.name === "slug")) {
      sqlite.exec("ALTER TABLE chat_bots ADD COLUMN slug TEXT");
    }
    if (!botCols.some((c) => c.name === "status")) {
      sqlite.exec(
        "ALTER TABLE chat_bots ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
      );
    }
    if (!botCols.some((c) => c.name === "published_version_id")) {
      sqlite.exec("ALTER TABLE chat_bots ADD COLUMN published_version_id TEXT");
    }
    migrateLegacyRows = true;
  } else {
    if (!botCols.some((c) => c.name === "slug")) {
      sqlite.exec("ALTER TABLE chat_bots ADD COLUMN slug TEXT NOT NULL DEFAULT 'bot'");
    }
    if (!botCols.some((c) => c.name === "status")) {
      sqlite.exec(
        "ALTER TABLE chat_bots ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
      );
    }
    if (!botCols.some((c) => c.name === "published_version_id")) {
      sqlite.exec("ALTER TABLE chat_bots ADD COLUMN published_version_id TEXT");
    }
    if (!botCols.some((c) => c.name === "owner_user_id")) {
      sqlite.exec(
        "ALTER TABLE chat_bots ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT '' REFERENCES users(id)",
      );
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_bot_versions (
      id TEXT PRIMARY KEY NOT NULL,
      bot_id TEXT NOT NULL REFERENCES chat_bots(id),
      version INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      published_at INTEGER,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_bot_channels (
      bot_id TEXT NOT NULL REFERENCES chat_bots(id),
      channel TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (bot_id, channel)
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_bot_api_keys (
      id TEXT PRIMARY KEY NOT NULL,
      bot_id TEXT NOT NULL REFERENCES chat_bots(id),
      key_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at INTEGER,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_bot_publish_log (
      id TEXT PRIMARY KEY NOT NULL,
      bot_id TEXT NOT NULL REFERENCES chat_bots(id),
      version_id TEXT,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  if (migrateLegacyRows) {
    migrateLegacyChatBotRows(sqlite);
    rebuildLegacyChatBotsTable(sqlite);
  }
}

function rebuildLegacyChatBotsTable(sqlite: Database.Database): void {
  const botCols = sqlite.prepare("PRAGMA table_info(chat_bots)").all() as { name: string }[];
  if (!botCols.some((c) => c.name === "system_prompt")) {
    return;
  }

  sqlite.exec("UPDATE chat_bots SET owner_user_id = user_id WHERE owner_user_id IS NULL");

  const missingSlug = sqlite
    .prepare("SELECT id, user_id, name FROM chat_bots WHERE slug IS NULL OR slug = ''")
    .all() as Array<{ id: string; user_id: string; name: string }>;
  const slugExists = sqlite.prepare("SELECT 1 FROM chat_bots WHERE slug = ? LIMIT 1");
  const setSlug = sqlite.prepare(
    "UPDATE chat_bots SET slug = ?, updated_at = ? WHERE id = ?",
  );
  const now = Date.now();
  for (const row of missingSlug) {
    let slug = row.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (!slug) slug = "bot";
    let candidate = slug;
    let n = 2;
    while (slugExists.get(candidate)) {
      candidate = `${slug}-${n}`;
      n++;
    }
    setSlug.run(candidate, now, row.id);
  }

  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec(`
    CREATE TABLE chat_bots_new (
      id TEXT PRIMARY KEY NOT NULL,
      owner_user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      published_version_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  sqlite.exec(`
    INSERT INTO chat_bots_new (
      id, owner_user_id, name, slug, status, published_version_id, created_at, updated_at
    )
    SELECT
      id,
      COALESCE(owner_user_id, user_id),
      name,
      COALESCE(NULLIF(trim(slug), ''), 'bot-' || substr(id, 1, 8)),
      COALESCE(status, 'draft'),
      published_version_id,
      created_at,
      updated_at
    FROM chat_bots;
  `);
  sqlite.exec("DROP TABLE chat_bots");
  sqlite.exec("ALTER TABLE chat_bots_new RENAME TO chat_bots");
  sqlite.exec("PRAGMA foreign_keys = ON");
}

function migrateLegacyChatBotRows(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      `SELECT id, user_id, name, system_prompt, rag_template, knowledge_base_ids
       FROM chat_bots WHERE slug IS NULL OR slug = ''`,
    )
    .all() as Array<{
    id: string;
    user_id: string;
    name: string;
    system_prompt: string;
    rag_template: string;
    knowledge_base_ids: string;
  }>;

  const slugExists = sqlite.prepare("SELECT 1 FROM chat_bots WHERE slug = ? LIMIT 1");
  const updateBot = sqlite.prepare(
    `UPDATE chat_bots SET slug = ?, status = 'draft', owner_user_id = COALESCE(owner_user_id, user_id), updated_at = ?
     WHERE id = ?`,
  );
  const insertVersion = sqlite.prepare(
    `INSERT OR IGNORE INTO chat_bot_versions (id, bot_id, version, config_json, published_at, created_by, created_at)
     VALUES (?, ?, 1, ?, NULL, ?, ?)`,
  );
  const hasDraft = sqlite.prepare(
    `SELECT 1 FROM chat_bot_versions WHERE bot_id = ? AND published_at IS NULL LIMIT 1`,
  );

  const now = Date.now();
  for (const row of rows) {
    let slug = row.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (!slug) slug = "bot";
    let candidate = slug;
    let n = 2;
    while (slugExists.get(candidate)) {
      candidate = `${slug}-${n}`;
      n++;
    }
    updateBot.run(candidate, now, row.id);

    if (!hasDraft.get(row.id)) {
      const config = JSON.stringify({
        systemPrompt: row.system_prompt ?? "",
        openingMessage: "你好，有什么可以帮你？",
        themeColor: "#cc5de8",
        modelId: "",
        mode: "rag",
        knowledgeBaseIds: JSON.parse(row.knowledge_base_ids || "[]"),
        ragTemplate: row.rag_template === "code" ? "code" : "support",
        fallbackToChat: true,
        accessPolicy: "public",
      });
      insertVersion.run(`draft-${row.id}`, row.id, config, row.user_id, now);
    }
  }
}

function migrateWorkflowVersionsDraftPublished(sqlite: Database.Database): void {
  const already = sqlite
    .prepare(
      `SELECT 1 FROM workflow_versions WHERE published_at IS NOT NULL LIMIT 1`,
    )
    .get();
  if (already) return;

  const workflows = sqlite
    .prepare(
      `SELECT id, published_version_id, published_at, created_by_user_id FROM workflows`,
    )
    .all() as Array<{
    id: string;
    published_version_id: string | null;
    published_at: number | null;
    created_by_user_id: string | null;
  }>;

  const listVersions = sqlite.prepare(
    `SELECT id, version, definition, semver_label, created_at FROM workflow_versions
     WHERE workflow_id = ? ORDER BY version ASC`,
  );
  const referencedIds = sqlite.prepare(
    `SELECT DISTINCT workflow_version_id FROM executions WHERE workflow_id = ?`,
  );
  const markPublished = sqlite.prepare(
    `UPDATE workflow_versions SET published_at = ?, published_by_user_id = ? WHERE id = ?`,
  );
  const markDraft = sqlite.prepare(
    `UPDATE workflow_versions SET published_at = NULL, version = 0 WHERE id = ?`,
  );
  const insertDraft = sqlite.prepare(
    `INSERT INTO workflow_versions (id, workflow_id, version, definition, semver_label, change_note, created_at, published_at)
     VALUES (?, ?, 0, ?, ?, NULL, ?, NULL)`,
  );
  const deleteVersion = sqlite.prepare(`DELETE FROM workflow_versions WHERE id = ?`);

  for (const wf of workflows) {
    const versions = listVersions.all(wf.id) as Array<{
      id: string;
      version: number;
      definition: string;
      semver_label: string;
      created_at: number;
    }>;
    if (versions.length === 0) continue;

    const latest = versions[versions.length - 1]!;
    const publishedId = wf.published_version_id;
  const refs = new Set(
      (referencedIds.all(wf.id) as Array<{ workflow_version_id: string }>).map(
        (r) => r.workflow_version_id,
      ),
    );

    if (publishedId) {
      const pubAt = wf.published_at ?? latest.created_at;
      markPublished.run(pubAt, wf.created_by_user_id, publishedId);
    }

    let draftId = latest.id;
    if (publishedId && latest.id === publishedId) {
      draftId = crypto.randomUUID();
      insertDraft.run(
        draftId,
        wf.id,
        latest.definition,
        latest.semver_label ?? "1.0.0",
        Date.now(),
      );
    } else {
      markDraft.run(latest.id);
    }

    for (const v of versions) {
      if (v.id === draftId) continue;
      if (v.id === publishedId) continue;
      if (refs.has(v.id)) continue;
      deleteVersion.run(v.id);
    }
  }
}
