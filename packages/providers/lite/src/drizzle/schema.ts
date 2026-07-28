import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  joinMethod: text("join_method"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  nickname: text("nickname").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userInviteTokens = sqliteTable("user_invite_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  invitedByUserId: text("invited_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  publishedVersionId: text("published_version_id"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const workflowCollaborators = sqliteTable(
  "workflow_collaborators",
  {
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workflowId, t.userId] })],
);

export const workflowVersions = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  version: integer("version").notNull(),
  definition: text("definition").notNull(),
  semverLabel: text("semver_label").notNull().default("1.0.0"),
  changeNote: text("change_note"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  publishedByUserId: text("published_by_user_id").references(() => users.id),
  publishNote: text("publish_note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const workflowPublishLog = sqliteTable("workflow_publish_log", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  versionId: text("version_id"),
  action: text("action").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const executions = sqliteTable("executions", {
  id: text("id").primaryKey(),
  traceId: text("trace_id").notNull(),
  workflowId: text("workflow_id")
    .notNull()
    .references(() => workflows.id),
  workflowVersionId: text("workflow_version_id")
    .notNull()
    .references(() => workflowVersions.id),
  definitionSnapshot: text("definition_snapshot").notNull(),
  status: text("status").notNull(),
  mode: text("mode").notNull(),
  environment: text("environment").notNull(),
  idempotencyKey: text("idempotency_key"),
  sessionId: text("session_id"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const runners = sqliteTable("runners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  platformOs: text("platform_os").notNull(),
  platformArch: text("platform_arch").notNull(),
  platformVersion: text("platform_version"),
  labels: text("labels").notNull().default("[]"),
  capabilities: text("capabilities").notNull().default("[]"),
  status: text("status").notNull(),
  maxConcurrent: integer("max_concurrent").notNull().default(10),
  runningJobs: integer("running_jobs").notNull().default(0),
  agentVersion: text("agent_version"),
  lastHeartbeatAt: integer("last_heartbeat_at", { mode: "timestamp" }),
  credentialHash: text("credential_hash").notNull().default(""),
  registeredAt: integer("registered_at", { mode: "timestamp" }).notNull(),
});

export const runnerRegistrationTokens = sqliteTable(
  "runner_registration_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdBy: text("created_by").references(() => users.id),
    labelsDefault: text("labels_default").notNull().default("[]"),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("runner_registration_tokens_token_hash").on(
      table.tokenHash,
    ),
  }),
);

export const nodeRuns = sqliteTable("node_runs", {
  id: text("id").primaryKey(),
  executionId: text("execution_id")
    .notNull()
    .references(() => executions.id),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull().default(0),
  inputRef: text("input_ref"),
  outputRef: text("output_ref"),
  outputData: text("output_data"),
  errorCode: text("error_code"),
  durationMs: integer("duration_ms"),
  runnerId: text("runner_id").references(() => runners.id),
  runnerPlatform: text("runner_platform"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const executionBlobs = sqliteTable("execution_blobs", {
  id: text("id").primaryKey(),
  executionId: text("execution_id")
    .notNull()
    .references(() => executions.id),
  nodeRunId: text("node_run_id").references(() => nodeRuns.id),
  kind: text("kind").notNull(),
  storagePath: text("storage_path").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").notNull(),
  scope: text("scope").notNull(),
  executionId: text("execution_id")
    .notNull()
    .references(() => executions.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const schedulerLeases = sqliteTable("scheduler_leases", {
  id: text("id").primaryKey(),
  holder: text("holder").notNull(),
  leaseUntil: integer("lease_until", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull(),
  leaseOwner: text("lease_owner"),
  leaseUntil: integer("lease_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  dataEncrypted: text("data_encrypted").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const chatBots = sqliteTable("chat_bots", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("draft"),
  publishedVersionId: text("published_version_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const chatBotVersions = sqliteTable("chat_bot_versions", {
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .references(() => chatBots.id),
  version: integer("version").notNull(),
  configJson: text("config_json").notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const chatBotChannels = sqliteTable(
  "chat_bot_channels",
  {
    botId: text("bot_id")
      .notNull()
      .references(() => chatBots.id),
    channel: text("channel").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    configJson: text("config_json").notNull().default("{}"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.botId, t.channel] }),
  }),
);

export const chatBotApiKeys = sqliteTable("chat_bot_api_keys", {
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .references(() => chatBots.id),
  keyHash: text("key_hash").notNull(),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const chatBotPublishLog = sqliteTable("chat_bot_publish_log", {
  id: text("id").primaryKey(),
  botId: text("bot_id")
    .notNull()
    .references(() => chatBots.id),
  versionId: text("version_id"),
  action: text("action").notNull(),
  detailJson: text("detail_json").notNull().default("{}"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("user"),
  botId: text("bot_id").references(() => chatBots.id),
  botVersionId: text("bot_version_id").references(() => chatBotVersions.id),
  publicClientToken: text("public_client_token"),
  mode: text("mode").notNull().default("chat"),
  knowledgeBaseIds: text("knowledge_base_ids").notNull().default("[]"),
  ragTemplate: text("rag_template").notNull().default("support"),
  systemPrompt: text("system_prompt").notNull().default(""),
  modelId: text("model_id"),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: text("citations"),
  feedback: text("feedback"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const knowledgeBaseCollaborators = sqliteTable(
  "knowledge_base_collaborators",
  {
    knowledgeBaseId: text("knowledge_base_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.knowledgeBaseId, t.userId] })],
);

export const knowledgeBases = sqliteTable("knowledge_bases", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  embeddingModel: text("embedding_model").notNull().default("nomic-embed-text"),
  chunkSize: integer("chunk_size").notNull().default(1000),
  chunkOverlap: integer("chunk_overlap").notNull().default(200),
  topK: integer("top_k").notNull().default(5),
  similarityThreshold: integer("similarity_threshold").notNull().default(50),
  hybridSearch: integer("hybrid_search", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const knowledgeSyncSources = sqliteTable("knowledge_sync_sources", {
  id: text("id").primaryKey(),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id),
  kind: text("kind").notNull(),
  configJson: text("config_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const knowledgeDocuments = sqliteTable("knowledge_documents", {
  id: text("id").primaryKey(),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  storagePath: text("storage_path").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const knowledgeChunks = sqliteTable("knowledge_chunks", {
  id: text("id").primaryKey(),
  knowledgeBaseId: text("knowledge_base_id")
    .notNull()
    .references(() => knowledgeBases.id),
  documentId: text("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  embeddingJson: text("embedding_json").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
});

export const agentSessionMessages = sqliteTable("agent_session_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  executionId: text("execution_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  locale: text("locale").notNull().default("zh-CN"),
  themePreference: text("theme_preference").notNull().default("system"),
  themeId: text("theme_id").notNull().default("dark"),
  executionEnvironment: text("execution_environment").notNull().default("test"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const envVars = sqliteTable("env_vars", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  scopeId: text("scope_id").notNull().default(""),
  environment: text("environment").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const variables = sqliteTable("variables", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  scopeId: text("scope_id").notNull().default(""),
  environment: text("environment").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const modelProviders = sqliteTable("model_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  baseUrl: text("base_url").notNull(),
  credentialId: text("credential_id").references(() => credentials.id),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  healthStatus: text("health_status").notNull().default("unknown"),
  lastHealthAt: integer("last_health_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sourceFormat: text("source_format").notNull(),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").notNull().default("active"),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const skillFiles = sqliteTable(
  "skill_files",
  {
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
    path: text("path").notNull(),
    content: text("content"),
    contentHash: text("content_hash").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.skillId, t.path] }),
  }),
);

export const skillScanRoots = sqliteTable("skill_scan_roots", {
  id: text("id").primaryKey(),
  runnerId: text("runner_id"),
  rootPath: text("root_path").notNull(),
  lastScanAt: integer("last_scan_at", { mode: "timestamp" }),
  skillsFound: integer("skills_found").notNull().default(0),
});

export const instructionContexts = sqliteTable(
  "instruction_contexts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    sourceFormat: text("source_format").notNull(),
    filePath: text("file_path").notNull(),
    rootPath: text("root_path").notNull(),
    contentHash: text("content_hash").notNull(),
    pathsJson: text("paths_json"),
    loadPhase: text("load_phase").notNull().default("always"),
    tokenEstimate: integer("token_estimate"),
    status: text("status").notNull().default("active"),
    lastScannedAt: integer("last_scanned_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    rootFileHash: uniqueIndex("instruction_contexts_root_file_hash").on(
      t.rootPath,
      t.filePath,
      t.contentHash,
    ),
  }),
);

export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => modelProviders.id),
    modelName: text("model_name").notNull(),
    capabilities: text("capabilities").notNull().default('["chat"]'),
    isDefaultChat: integer("is_default_chat", { mode: "boolean" })
      .notNull()
      .default(false),
    isDefaultWorkflow: integer("is_default_workflow", { mode: "boolean" })
      .notNull()
      .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    source: text("source").notNull().default("manual"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    providerModelUnique: uniqueIndex("models_provider_id_model_name").on(
      table.providerId,
      table.modelName,
    ),
  }),
);
