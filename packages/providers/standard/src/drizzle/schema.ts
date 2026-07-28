import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('active'),
  joinMethod: text('join_method'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
  nickname: text('nickname').notNull().default(''),
  avatarUrl: text('avatar_url').notNull().default(''),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const userInviteTokens = pgTable('user_invite_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  usedAt: timestamp('used_at', { mode: 'date' }),
  invitedByUserId: text('invited_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('draft'),
  publishedVersionId: text('published_version_id'),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  createdByUserId: text('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const workflowCollaborators = pgTable(
  'workflow_collaborators',
  {
    workflowId: text('workflow_id')
      .notNull()
      .references(() => workflows.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workflowId, t.userId] })],
);

export const workflowVersions = pgTable('workflow_versions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id),
  version: integer('version').notNull(),
  definition: text('definition').notNull(),
  semverLabel: text('semver_label').notNull().default('1.0.0'),
  changeNote: text('change_note'),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  publishedByUserId: text('published_by_user_id').references(() => users.id),
  publishNote: text('publish_note'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const workflowPublishLog = pgTable('workflow_publish_log', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id),
  versionId: text('version_id'),
  action: text('action').notNull(),
  detailJson: text('detail_json').notNull().default('{}'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const executions = pgTable('executions', {
  id: text('id').primaryKey(),
  traceId: text('trace_id').notNull(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id),
  workflowVersionId: text('workflow_version_id')
    .notNull()
    .references(() => workflowVersions.id),
  definitionSnapshot: text('definition_snapshot').notNull(),
  status: text('status').notNull(),
  mode: text('mode').notNull(),
  environment: text('environment').notNull(),
  idempotencyKey: text('idempotency_key'),
  sessionId: text('session_id'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  finishedAt: timestamp('finished_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const nodeRuns = pgTable('node_runs', {
  id: text('id').primaryKey(),
  executionId: text('execution_id')
    .notNull()
    .references(() => executions.id),
  nodeId: text('node_id').notNull(),
  nodeType: text('node_type').notNull(),
  status: text('status').notNull(),
  attempt: integer('attempt').notNull().default(0),
  inputRef: text('input_ref'),
  outputRef: text('output_ref'),
  errorCode: text('error_code'),
  durationMs: integer('duration_ms'),
  runnerId: text('runner_id'),
  runnerPlatform: text('runner_platform'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const credentials = pgTable('credentials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  dataEncrypted: text('data_encrypted').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const envVars = pgTable(
  'env_vars',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull(),
    scopeId: text('scope_id').notNull().default(''),
    environment: text('environment').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    sensitive: boolean('sensitive').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
  },
  (t) => [uniqueIndex('env_vars_scope_key').on(t.scope, t.scopeId, t.environment, t.key)],
);

export const variables = pgTable(
  'variables',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull(),
    scopeId: text('scope_id').notNull().default(''),
    environment: text('environment').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    sensitive: boolean('sensitive').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
  },
  (t) => [uniqueIndex('variables_scope_key').on(t.scope, t.scopeId, t.environment, t.key)],
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  keyHash: text('key_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  locale: text('locale').notNull().default('zh-CN'),
  themePreference: text('theme_preference').notNull().default('system'),
  themeId: text('theme_id').notNull().default('dark'),
  executionEnvironment: text('execution_environment').notNull().default('test'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').notNull(),
  scope: text('scope').notNull(),
  executionId: text('execution_id')
    .notNull()
    .references(() => executions.id),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull(),
  leaseOwner: text('lease_owner'),
  leaseUntil: timestamp('lease_until', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  sensitive: boolean('sensitive').notNull().default(false),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const agentSessionMessages = pgTable('agent_session_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  executionId: text('execution_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  },
  (t) => [index('password_reset_tokens_user_id').on(t.userId)],
);

export const knowledgeBases = pgTable('knowledge_bases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  embeddingModel: text('embedding_model').notNull().default('nomic-embed-text'),
  chunkSize: integer('chunk_size').notNull().default(1000),
  chunkOverlap: integer('chunk_overlap').notNull().default(200),
  topK: integer('top_k').notNull().default(5),
  similarityThreshold: integer('similarity_threshold').notNull().default(50),
  hybridSearch: boolean('hybrid_search').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const knowledgeSyncSources = pgTable('knowledge_sync_sources', {
  id: text('id').primaryKey(),
  knowledgeBaseId: text('knowledge_base_id')
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  configJson: text('config_json').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { mode: 'date' }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: text('id').primaryKey(),
  knowledgeBaseId: text('knowledge_base_id')
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  storagePath: text('storage_path').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  chunkCount: integer('chunk_count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: text('id').primaryKey(),
    knowledgeBaseId: text('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    embeddingJson: text('embedding_json'),
    metadataJson: text('metadata_json').notNull().default('{}'),
  },
  (t) => [index('knowledge_chunks_kb_id').on(t.knowledgeBaseId)],
);

export const chatBots = pgTable('chat_bots', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('draft'),
  publishedVersionId: text('published_version_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const chatBotVersions = pgTable('chat_bot_versions', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => chatBots.id),
  version: integer('version').notNull(),
  configJson: text('config_json').notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const chatBotChannels = pgTable(
  'chat_bot_channels',
  {
    botId: text('bot_id')
      .notNull()
      .references(() => chatBots.id),
    channel: text('channel').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    configJson: text('config_json').notNull().default('{}'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.botId, t.channel] }),
  }),
);

export const chatBotApiKeys = pgTable('chat_bot_api_keys', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => chatBots.id),
  keyHash: text('key_hash').notNull(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const chatBotPublishLog = pgTable('chat_bot_publish_log', {
  id: text('id').primaryKey(),
  botId: text('bot_id')
    .notNull()
    .references(() => chatBots.id),
  versionId: text('version_id'),
  action: text('action').notNull(),
  detailJson: text('detail_json').notNull().default('{}'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('user'),
  botId: text('bot_id').references(() => chatBots.id),
  botVersionId: text('bot_version_id').references(() => chatBotVersions.id),
  publicClientToken: text('public_client_token'),
  mode: text('mode').notNull().default('chat'),
  knowledgeBaseIds: text('knowledge_base_ids').notNull().default('[]'),
  ragTemplate: text('rag_template').notNull().default('support'),
  systemPrompt: text('system_prompt').notNull().default(''),
  modelId: text('model_id'),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => chatSessions.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  citations: text('citations'),
  feedback: text('feedback'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const modelProviders = pgTable('model_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  baseUrl: text('base_url').notNull(),
  credentialId: text('credential_id').references(() => credentials.id),
  enabled: boolean('enabled').notNull().default(true),
  healthStatus: text('health_status').notNull().default('unknown'),
  lastHealthAt: timestamp('last_health_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const models = pgTable(
  'models',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .notNull()
      .references(() => modelProviders.id),
    modelName: text('model_name').notNull(),
    capabilities: text('capabilities').notNull().default('["chat"]'),
    isDefaultChat: boolean('is_default_chat').notNull().default(false),
    isDefaultWorkflow: boolean('is_default_workflow').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    source: text('source').notNull().default('manual'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
  },
  (t) => ({
    providerModelUnique: uniqueIndex('models_provider_id_model_name').on(
      t.providerId,
      t.modelName,
    ),
  }),
);
