import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { normalizeLocale } from '../i18n/locales.js';

function clientI18n(key: string): string {
  const locale =
    typeof localStorage !== 'undefined'
      ? normalizeLocale(localStorage.getItem('rxwf.locale'))
      : 'zh-CN';
  return getLocaleBundle(locale)[key] ?? key;
}

export interface SystemFeatures {
  deployProfile: string;
  featurePlus: boolean;
  httpPort: number;
  publicUrl: string;
  version: string;
}

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  hybridSearchEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  accessRole?: WorkflowAccessRole | null;
  ownerEmail?: string | null;
  ownerNickname?: string | null;
}

export interface KnowledgeSyncSourceSummary {
  id: string;
  knowledgeBaseId: string;
  kind: string;
  config: { path: string };
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatBotSummary {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatBotDraftConfig {
  systemPrompt: string;
  openingMessage: string;
  themeColor: string;
  modelId: string;
  mode: 'chat' | 'rag';
  knowledgeBaseIds: string[];
  ragTemplate: 'support' | 'code';
  fallbackToChat: boolean;
  accessPolicy: 'public' | 'authenticated' | 'role';
}

export interface KnowledgeDocumentSummary {
  id: string;
  knowledgeBaseId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkPreview {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  mode?: 'chat' | 'rag';
  knowledgeBaseIds?: string[];
  ragTemplate?: string;
  modelId?: string | null;
}

export interface ChatCitation {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: ChatCitation[];
  feedback?: 'up' | 'down' | null;
  createdAt: string;
}

export type ModelProviderKind = 'ollama' | 'openai-compatible';
export type ModelHealthStatus = 'ok' | 'error' | 'unknown';

export interface ModelProviderSummary {
  id: string;
  name: string;
  kind: ModelProviderKind;
  baseUrl: string;
  credentialId: string | null;
  enabled: boolean;
  healthStatus: ModelHealthStatus;
  lastHealthAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelSummary {
  id: string;
  providerId: string;
  modelName: string;
  capabilities: string[];
  isDefaultChat: boolean;
  isDefaultWorkflow: boolean;
  enabled: boolean;
  source: 'manual' | 'discovered';
  createdAt: string;
  updatedAt: string;
}

export type ChatProcessingPhase = 'rag_search' | 'rag_fallback' | 'thinking';

export type ChatStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'status'; phase: ChatProcessingPhase; detail?: string }
  | { type: 'done'; messageId: string; citations?: ChatCitation[] }
  | { type: 'aborted' }
  | { type: 'error'; code: string; message: string };



export type AgentStepStatus = 'running' | 'success' | 'failed';

export interface AgentStepRecord {
  type: 'tool' | 'token' | 'agent_step';
  tool?: string;
  status: AgentStepStatus;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  content?: string;
}

export interface ExecutionNodeRunLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface ExecutionNodeRun {
  nodeId: string;
  nodeType?: string;
  status: string;
  errorCode?: string;
  durationMs?: number;
  runnerPlatform?: { os: string };
  outputData?: unknown[][] | null;
  metadata?: {
    agentSteps?: AgentStepRecord[];
    logs?: ExecutionNodeRunLogEntry[];
    hitl?: {
      prompt?: string;
      summary?: string;
      allowReject?: boolean;
      allowSupplement?: boolean;
      decision?: string;
      comment?: string;
      supplement?: string;
      resolvedAt?: string;
    };
  };
}

export interface ExecutionDetail {
  id: string;
  status: string;
  traceId?: string;
  workflowId: string;
  workflowVersionId?: string;
  mode?: string;
  startedAt?: string;
  finishedAt?: string;
  definitionSnapshot?: WorkflowDefinition;
  nodeRuns: ExecutionNodeRun[];
}

export interface AuthUser {
  email: string;
  role: string;
  mustChangePassword?: boolean;
  nickname?: string;
  avatarUrl?: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  isAdmin: boolean;
  status: 'active' | 'disabled' | 'pending_invite';
  joinMethod: 'invite' | 'direct' | null;
  lastLoginAt: string | null;
}

export type WorkflowCollaboratorRole = 'owner' | 'editor' | 'viewer';

export type WorkflowAccessRole = WorkflowCollaboratorRole | 'admin';

export interface WorkflowCollaborator {
  userId: string;
  email: string;
  role: WorkflowCollaboratorRole;
  createdAt: string;
}

export interface WorkflowCollaboratorsResponse {
  creatorUserId: string | null;
  creatorEmail: string | null;
  collaborators: WorkflowCollaborator[];
}

export interface KnowledgeCollaboratorsResponse {
  ownerUserId: string;
  ownerEmail: string | null;
  collaborators: WorkflowCollaborator[];
}



export interface AuthStatus {

  needsSetup: boolean;

  authenticated: boolean;

  user: AuthUser | null;

}

export interface AuthBranding {
  productName: string;
  logoUrl: string;
}

export interface SystemSettingsSnapshot {
  passwordResetEnabled: boolean;
  smtpConfigured?: boolean;
}

export interface PlatformEnvItem {
  key: string;
  value: string;
  sensitive: boolean;
  requiresRestart: boolean;
  labelKey: string;
  descriptionKey: string;
  valueHintKey: string;
  configured: boolean;
  valueType:
    | 'string'
    | 'password'
    | 'url'
    | 'path'
    | 'bool'
    | 'int'
    | 'port'
    | 'double';
  pathHost?: 'controlPlane' | 'runner';
  pathKind?: 'directory' | 'file';
}

export type WebSearchProviderId = 'tavily' | 'brave' | 'bing' | 'custom';

export interface WebSearchSettingsSnapshot {
  enabled: boolean;
  defaultProvider: WebSearchProviderId;
  defaultCredentialId?: string;
  maxQueriesPerExecution: number;
  timeoutMs: number;
  maxResults: number;
  allowedDomains?: string[];
  customBaseUrl?: string;
}

export interface KnowledgePlatformSettingsSnapshot {
  configured: boolean;
  editable: boolean;
  embedding: {
    provider: 'ollama' | 'openai-compatible';
    baseUrl: string;
    defaultModel: string;
    credentialId?: string | null;
    dimensions?: number;
  };
  rag: {
    defaultModelId: string;
    defaultTemplate: 'support' | 'code';
    fallbackToChat: boolean;
  };
  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
    hybridSearchEnabled: boolean;
  };
  status: {
    profile: string;
    jobQueue: 'lite' | 'bullmq';
  };
}



export interface WorkflowSummary {

  id: string;

  name: string;

  description?: string;

  status: string;

  version: number;

  accessRole?: WorkflowAccessRole | null;

  workflowKind?: 'automation' | 'agent';

  createdAt?: string;

  updatedAt?: string;

  createdByEmail?: string | null;

  createdByNickname?: string | null;

}



export interface WorkflowDefinition {

  schemaVersion: number;

  name: string;

  active?: boolean;

  nodes: Array<{

    id: string;

    type: string;

    name: string;

    position: { x: number; y: number };

    parameters: Record<string, unknown>;

    disabled?: boolean;

    runner?: {
      mode: 'inherit' | 'embedded' | 'auto' | 'pinned' | 'label';
      runnerId?: string;
      platform?: 'windows' | 'linux' | 'macos';
      labels?: string[];
    };

  }>;

  connections: Array<{
    from: string;
    to: string;
    fromOutput?: string;
    toInput?: string;
    outputIndex?: number;
  }>;

  settings?: Record<string, unknown>;

}



export class AwfClientError extends Error {
  readonly code?: string;
  readonly traceId?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string, traceId?: string) {
    super(message);
    this.name = 'AwfClientError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {

  const headers = new Headers(init.headers);

  if (init.body && !headers.has('content-type')) {

    headers.set('content-type', 'application/json');

  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error(
      clientI18n('api.error.connection'),
    );
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
      traceId?: string;
      error?: string;
    };
    let msg =
      err.message ??
      (typeof err.error === 'string' ? err.error : undefined) ??
      `HTTP ${res.status}`;
    if (res.status === 500 && !err.message && !err.error) {
      msg = clientI18n('api.error.server');
    }
    throw new AwfClientError(msg, res.status, err.code, err.traceId);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;

}

async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'omit' });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const publicChat = {
  createSession: (slug: string) =>
    publicFetch<{
      sessionId: string;
      clientToken: string;
      bot: { name: string; slug: string; themeColor: string };
    }>(`/api/public/chat/${encodeURIComponent(slug)}/session`, { method: 'POST' }),

  listMessages: (sessionId: string, clientToken: string) =>
    publicFetch<{ messages: ChatMessage[] }>(`/api/public/chat/sessions/${sessionId}/messages`, {
      headers: { 'x-chat-client-token': clientToken },
    }),

  stream: async (
    sessionId: string,
    clientToken: string,
    content: string,
    opts: { onEvent: (ev: ChatStreamEvent) => void; signal?: AbortSignal },
  ): Promise<void> => {
    const res = await fetch(`/api/public/chat/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-chat-client-token': clientToken,
      },
      body: JSON.stringify({ content }),
      credentials: 'omit',
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body');
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') return;
        const ev = JSON.parse(payload) as ChatStreamEvent;
        opts.onEvent(ev);
        if (ev.type === 'error') throw new Error(ev.message);
      }
    }
  },
};

export async function streamChatRegenerate(
  sessionId: string,
  messageId: string,
  opts: {
    mode?: 'chat' | 'rag';
    modelId?: string;
    fallbackToChat?: boolean;
    signal?: AbortSignal;
    onEvent: (ev: ChatStreamEvent) => void;
  },
): Promise<void> {
  const res = await fetch(
    `/api/chat/sessions/${sessionId}/messages/${messageId}/regenerate`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: opts.mode,
        modelId: opts.modelId,
        fallbackToChat: opts.fallbackToChat,
      }),
      credentials: 'include',
      signal: opts.signal,
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        const ev = JSON.parse(payload) as ChatStreamEvent;
        opts.onEvent(ev);
        if (ev.type === 'error') throw new Error(ev.message);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}

export async function streamChat(
  sessionId: string,
  content: string,
  opts: {
    mode?: 'chat' | 'rag';
    modelId?: string;
    fallbackToChat?: boolean;
    signal?: AbortSignal;
    onEvent: (ev: ChatStreamEvent) => void;
  },
): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content,
      mode: opts.mode,
      modelId: opts.modelId,
      fallbackToChat: opts.fallbackToChat,
    }),
    credentials: 'include',
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No body');
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;
      try {
        const ev = JSON.parse(payload) as ChatStreamEvent;
        opts.onEvent(ev);
        if (ev.type === 'error') throw new Error(ev.message);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
}

export const api = {

  features: () => apiFetch<SystemFeatures>('/api/system/features'),

  auth: {

    status: () => apiFetch<AuthStatus>('/api/auth/status'),

    setup: (email: string, password: string) =>

      apiFetch<{ user: AuthUser }>('/api/auth/setup', {

        method: 'POST',

        body: JSON.stringify({ email, password }),

      }),

    login: (email: string, password: string) =>

      apiFetch<{ user: AuthUser }>('/api/auth/login', {

        method: 'POST',

        body: JSON.stringify({ email, password }),

      }),

    logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

    passwordResetStatus: () =>
      apiFetch<{ enabled: boolean }>('/api/auth/password-reset-status'),

    branding: () => apiFetch<AuthBranding>('/api/auth/branding'),

    forgotPassword: (email: string) =>
      apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      apiFetch<{ ok: boolean }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),

    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      apiFetch<{ ok: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    acceptInvite: (body: { token: string; password: string }) =>
      apiFetch<{ ok: boolean }>('/api/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

  },

  adminUsers: {
    list: () =>
      apiFetch<{ users: AdminUserSummary[] }>('/api/admin/users').then((r) => r.users),

    invite: (body: { email: string; isAdmin?: boolean }) =>
      apiFetch<{ ok: boolean }>('/api/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    create: (body: {
      email: string;
      password?: string;
      isAdmin?: boolean;
      mustChangePassword?: boolean;
    }) =>
      apiFetch<{ user: AdminUserSummary; temporaryPassword?: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    patch: (
      id: string,
      body: {
        status?: AdminUserSummary['status'];
        isAdmin?: boolean;
        resetPassword?: boolean;
      },
    ) =>
      apiFetch<{ ok: boolean; temporaryPassword?: string }>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    remove: (id: string) =>
      apiFetch<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),

    resendInvite: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/users/${id}/resend-invite`, { method: 'POST' }),

    revokeInvite: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/admin/users/${id}/revoke-invite`, { method: 'POST' }),
  },

  settings: {
    getSystem: () => apiFetch<SystemSettingsSnapshot>('/api/settings/system'),

    testEmail: () =>
      apiFetch<{ ok: boolean }>('/api/settings/system/test-email', { method: 'POST' }),

    getWebSearch: () => apiFetch<WebSearchSettingsSnapshot>('/api/settings/web-search'),

    updateWebSearch: (body: WebSearchSettingsSnapshot) =>
      apiFetch<{ ok: boolean } & WebSearchSettingsSnapshot>('/api/settings/web-search', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),

    testWebSearch: (body?: Partial<WebSearchSettingsSnapshot>) =>
      apiFetch<{ ok: boolean; latencyMs: number; preview: string }>(
        '/api/settings/web-search/test',
        {
          method: 'POST',
          body: JSON.stringify(body ?? {}),
        },
      ),

    getKnowledge: () => apiFetch<KnowledgePlatformSettingsSnapshot>('/api/settings/knowledge'),

    updateKnowledge: (body: KnowledgePlatformSettingsSnapshot) =>
      apiFetch<{ ok: boolean; embeddingChanged: boolean } & KnowledgePlatformSettingsSnapshot>(
        '/api/settings/knowledge',
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      ),

    testKnowledgeEmbedding: (body: KnowledgePlatformSettingsSnapshot) =>
      apiFetch<{ ok: boolean; dimensions: number; latencyMs: number }>(
        '/api/settings/knowledge/test-embedding',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),

    reindexAllKnowledgeBases: () =>
      apiFetch<{ queued: number }>('/api/knowledge-bases/reindex-all', { method: 'POST' }),
  },

  workflows: {

    list: (scope?: 'mine' | 'shared' | 'all', kind?: 'automation' | 'agent') => {
      const params = new URLSearchParams();
      if (scope) params.set('scope', scope);
      if (kind) params.set('kind', kind);
      const q = params.toString() ? `?${params.toString()}` : '';
      return apiFetch<{ workflows: WorkflowSummary[] }>(`/api/workflows${q}`).then(
        (r) => r.workflows,
      );
    },

    listExposedAsTool: (scope?: 'mine' | 'shared' | 'all') => {
      const params = new URLSearchParams({ exposeAsTool: 'true' });
      if (scope) params.set('scope', scope);
      return apiFetch<{ workflows: WorkflowSummary[] }>(
        `/api/workflows?${params.toString()}`,
      ).then((r) => r.workflows);
    },

    getSubworkflowInputSchema: (workflowId: string) =>
      apiFetch<{
        mode: 'fields' | 'jsonExample' | 'acceptAll';
        fields: Array<{
          name: string;
          type: string;
          description?: string;
          required?: boolean;
        }>;
        jsonSchema: Record<string, unknown>;
      }>(`/api/workflows/${encodeURIComponent(workflowId)}/subworkflow-input-schema`),

    listCollaborators: (workflowId: string) =>
      apiFetch<WorkflowCollaboratorsResponse>(
        `/api/workflows/${encodeURIComponent(workflowId)}/collaborators`,
      ),

    updateCollaborators: (
      workflowId: string,
      collaborators: Array<{ userId: string; role: WorkflowCollaboratorRole }>,
    ) =>
      apiFetch<WorkflowCollaboratorsResponse>(
        `/api/workflows/${encodeURIComponent(workflowId)}/collaborators`,
        {
          method: 'PUT',
          body: JSON.stringify({ collaborators }),
        },
      ),

    listCollaboratorCandidates: (workflowId: string) =>
      apiFetch<{ users: Array<{ id: string; email: string }> }>(
        `/api/workflows/${encodeURIComponent(workflowId)}/collaborators/candidates`,
      ).then((r) => r.users),

    get: (id: string) =>
      apiFetch<{
        workflow: {
          id: string;
          definition: WorkflowDefinition;
          status: string;
          version: number;
          semverLabel?: string;
          publishedVersion?: number | null;
          publishedSemverLabel?: string | null;
          hasUnpublishedChanges?: boolean;
          accessRole?: WorkflowAccessRole | null;
        };
      }>(`/api/workflows/${id}`).then((r) => r.workflow),

    create: (name: string, definition: WorkflowDefinition, description?: string) =>
      apiFetch<{ id: string }>('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({ name, definition, description }),
      }),

    updateMeta: (id: string, data: { name: string; description?: string }) =>
      apiFetch<{ id: string }>(`/api/workflows/${encodeURIComponent(id)}/meta`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    update: (id: string, definition: WorkflowDefinition) =>
      apiFetch<{ id: string }>(`/api/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ definition }),
      }),

    publish: (id: string, options?: { publishNote?: string }) =>
      apiFetch<{ id: string; status: string; version: number; semverLabel: string }>(
        `/api/workflows/${id}/publish`,
        {
          method: 'POST',
          body: JSON.stringify(options ?? {}),
        },
      ),

    unpublish: (id: string) =>
      apiFetch<{ id: string; status: string }>(`/api/workflows/${id}/unpublish`, {
        method: 'POST',
      }),

    remove: (id: string) =>
      apiFetch<void>(`/api/workflows/${id}`, { method: 'DELETE' }),

    listPublishedVersions: (id: string) =>
      apiFetch<{
        versions: Array<{
          id: string;
          version: number;
          semverLabel: string;
          publishNote?: string;
          publishedAt: string;
          publishedByUserId?: string;
          publishedByEmail?: string;
          isCurrent: boolean;
        }>;
      }>(`/api/workflows/${id}/published-versions`).then((r) => r.versions),

    getPublishedVersionDefinition: (id: string, version: number) =>
      apiFetch<{ definition: WorkflowDefinition }>(
        `/api/workflows/${id}/published-versions/${version}/definition`,
      ).then((r) => r.definition),

    rollbackPublish: (id: string, version: number) =>
      apiFetch<{ id: string; version: number; semverLabel: string }>(
        `/api/workflows/${id}/published-versions/${version}/rollback`,
        { method: 'POST' },
      ),

    restoreDraftFromPublished: (id: string, version: number) =>
      apiFetch<{ id: string }>(
        `/api/workflows/${id}/published-versions/${version}/restore-draft`,
        { method: 'POST' },
      ),

    validate: (workflowId: string, definition: WorkflowDefinition) =>

      apiFetch<{ ok: boolean; errors?: { message: string }[] }>(

        `/api/workflows/${workflowId}/validate`,

        { method: 'POST', body: JSON.stringify({ definition }) },

      ),

    execute: (id: string) =>

      apiFetch<{ executionId: string; status: string }>(`/api/workflows/${id}/executions`, {

        method: 'POST',

        body: JSON.stringify({ mode: 'manual' }),

      }),

    debugNode: (
      definition: WorkflowDefinition,
      targetNodeId: string,
      pinData?: Record<string, { json: Record<string, unknown> }[]>,
      options?: {
        workflowId?: string;
        environment?: 'test' | 'prod';
      },
    ) =>
      apiFetch<{
        status: 'success' | 'failed';
        failedNodeId?: string;
        nodeResults: Record<
          string,
          {
            status: 'success' | 'failed' | 'skipped';
            itemCount: number;
            durationMs?: number;
            errorMessage?: string;
            errorCode?: string;
            outputItems?: { json: Record<string, unknown> }[][];
            logs?: Array<{
              level: 'info' | 'warn' | 'error';
              message: string;
              timestamp: string;
            }>;
            agentStream?: Array<{
              type: string;
              tool?: string;
              content?: string;
              input?: unknown;
              output?: unknown;
            }>;
          }
        >;
      }>('/api/workflows/debug-node', {
        method: 'POST',
        body: JSON.stringify({
          definition,
          targetNodeId,
          pinData,
          workflowId: options?.workflowId,
          environment: options?.environment,
          locale:
            typeof localStorage !== 'undefined'
              ? normalizeLocale(localStorage.getItem('rxwf.locale'))
              : undefined,
        }),
      }),

    debugNodeStream: async (
      definition: WorkflowDefinition,
      targetNodeId: string,
      pinData: Record<string, { json: Record<string, unknown> }[]> | undefined,
      options: {
        workflowId?: string;
        environment?: 'test' | 'prod';
        pinBranchData?: Record<string, { json: Record<string, unknown> }[][]>;
        onNodeResult?: (
          nodeId: string,
          nodeResult: {
            status: 'success' | 'failed' | 'skipped' | 'waiting';
            itemCount: number;
            durationMs?: number;
            errorMessage?: string;
            errorCode?: string;
            outputItems?: { json: Record<string, unknown> }[][];
            logs?: Array<{
              level: 'info' | 'warn' | 'error';
              message: string;
              timestamp: string;
            }>;
            agentStream?: Array<{
              type: string;
              tool?: string;
              content?: string;
              input?: unknown;
              output?: unknown;
              step?: unknown;
            }>;
          },
        ) => void;
        onNodeStarted?: (nodeId: string) => void;
        onAgentStream?: (
          nodeId: string,
          chunk: {
            type: string;
            tool?: string;
            content?: string;
            input?: unknown;
            output?: unknown;
            step?: unknown;
          },
        ) => void;
      },
    ): Promise<{
      status: 'success' | 'failed';
      failedNodeId?: string;
      executionId?: string;
      nodeResults: Record<
        string,
        {
          status: 'success' | 'failed' | 'skipped';
          itemCount: number;
          durationMs?: number;
          errorMessage?: string;
          outputItems?: { json: Record<string, unknown> }[][];
        }
      >;
    }> => {
      const res = await fetch('/api/workflows/debug-node', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          definition,
          targetNodeId,
          pinData,
          pinBranchData: options?.pinBranchData,
          workflowId: options?.workflowId,
          environment: options?.environment,
          stream: true,
          locale:
            typeof localStorage !== 'undefined'
              ? normalizeLocale(localStorage.getItem('rxwf.locale'))
              : undefined,
        }),
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const errBody = (await res.json()) as { message?: string };
          if (errBody.message) message = errBody.message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: {
        status: 'success' | 'failed';
        failedNodeId?: string;
        executionId?: string;
        nodeResults: Record<
          string,
          {
            status: 'success' | 'failed' | 'skipped';
            itemCount: number;
            durationMs?: number;
            errorMessage?: string;
            errorCode?: string;
            outputItems?: { json: Record<string, unknown> }[][];
          }
        >;
      } | null = null;

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') return;
        const ev = JSON.parse(payload) as {
          type: string;
          nodeId?: string;
          chunk?: {
            type: string;
            tool?: string;
            content?: string;
            input?: unknown;
            output?: unknown;
            step?: unknown;
          };
          nodeResult?: {
            status: 'success' | 'failed' | 'skipped';
            itemCount: number;
            durationMs?: number;
            errorMessage?: string;
            errorCode?: string;
            outputItems?: { json: Record<string, unknown> }[][];
          };
          status?: 'success' | 'failed';
          failedNodeId?: string;
          executionId?: string;
          nodeResults?: Record<
            string,
            {
              status: 'success' | 'failed' | 'skipped';
              itemCount: number;
              durationMs?: number;
              errorMessage?: string;
              outputItems?: { json: Record<string, unknown> }[][];
            }
          >;
          code?: string;
          message?: string;
        };
        if (ev.type === 'error') {
          throw new Error(ev.message ?? ev.code ?? 'debug stream error');
        }
        if (ev.type === 'nodeStarted' && ev.nodeId) {
          options.onNodeStarted?.(ev.nodeId);
        }
        if (ev.type === 'agentStream' && ev.nodeId && ev.chunk) {
          options.onAgentStream?.(ev.nodeId, ev.chunk);
        }
        if (ev.type === 'nodeResult' && ev.nodeId && ev.nodeResult) {
          options.onNodeResult?.(ev.nodeId, ev.nodeResult);
        }
        if (ev.type === 'done' && ev.status && ev.nodeResults) {
          finalResult = {
            status: ev.status,
            failedNodeId: ev.failedNodeId,
            executionId: ev.executionId,
            nodeResults: ev.nodeResults,
          };
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) processLine(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) processLine(line);
      }
      if (!finalResult) throw new Error('debug stream ended without result');
      return finalResult;
    },

    startWebhookListen: (
      workflowId: string,
      body: {
        webhookNodeId: string;
        targetNodeId: string;
        webhookPath: string;
        definition: WorkflowDefinition;
        pinData?: Record<string, { json: Record<string, unknown> }[]>;
        pinBranchData?: Record<string, { json: Record<string, unknown> }[][]>;
      },
    ) =>
      apiFetch<{ listenId: string; expiresAt: number; status: string }>(
        `/api/workflows/${workflowId}/webhook-listen`,
        { method: 'POST', body: JSON.stringify(body) },
      ),

    cancelWebhookListen: (workflowId: string, listenId: string) =>
      apiFetch<{ ok: boolean }>(`/api/workflows/${workflowId}/webhook-listen/${listenId}`, {
        method: 'DELETE',
      }),

    pollWebhookListenEvents: (
      workflowId: string,
      listenId: string,
      fromIndex: number,
    ) =>
      apiFetch<{
        listenId: string;
        status: string;
        events: Array<
          | { type: 'nodeStarted'; nodeId: string }
          | {
              type: 'nodeResult';
              nodeId: string;
              nodeResult: {
                status: 'success' | 'failed' | 'skipped' | 'waiting';
                itemCount: number;
                durationMs?: number;
                errorMessage?: string;
                errorCode?: string;
                outputItems?: { json: Record<string, unknown> }[][];
                logs?: Array<{
                  level: 'info' | 'warn' | 'error';
                  message: string;
                  timestamp: string;
                }>;
                agentStream?: Array<{ type: string; tool?: string; content?: string }>;
              };
            }
          | { type: 'agentStream'; nodeId: string; chunk: unknown }
          | {
              type: 'done';
              status: 'success' | 'failed';
              failedNodeId?: string;
              executionId?: string;
            }
          | { type: 'error'; code: string; message: string }
        >;
        nextIndex: number;
      }>(`/api/workflows/${workflowId}/webhook-listen/${listenId}?from=${fromIndex}`),

  },

  env: {
    list: () =>
      apiFetch<{ items: PlatformEnvItem[] }>('/api/env').then((r) => r.items),
    update: (items: Array<{ key: string; value: string }>) =>
      apiFetch<{ items: PlatformEnvItem[] }>('/api/env', {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }).then((r) => r.items),
    browse: (query: {
      host: 'controlPlane' | 'runner';
      runnerId?: string;
      path?: string;
      dirsOnly?: boolean;
    }) => {
      const params = new URLSearchParams();
      params.set('host', query.host);
      if (query.runnerId) params.set('runnerId', query.runnerId);
      if (query.path != null) params.set('path', query.path);
      if (query.dirsOnly === false) params.set('dirsOnly', '0');
      return apiFetch<{
        path: string;
        parent: string | null;
        entries: Array<{ name: string; path: string; kind: 'directory' | 'file' }>;
        host: 'controlPlane' | 'runner';
        runnerId?: string;
      }>(`/api/env/browse?${params.toString()}`);
    },
  },

  variables: {
    list: () =>
      apiFetch<{
        items: Array<{
          key: string;
          value: string;
          sensitive: boolean;
          testEnabled: boolean;
          prodEnabled: boolean;
          testId?: string;
          prodId?: string;
        }>;
      }>('/api/variables').then((r) => r.items),
    sync: (
      items: Array<{
        key: string;
        value: string;
        sensitive?: boolean;
        testEnabled?: boolean;
        prodEnabled?: boolean;
      }>,
    ) =>
      apiFetch<{
        items: Array<{
          key: string;
          value: string;
          sensitive: boolean;
          testEnabled: boolean;
          prodEnabled: boolean;
          testId?: string;
          prodId?: string;
        }>;
      }>('/api/variables', {
        method: 'PUT',
        body: JSON.stringify({ items }),
      }).then((r) => r.items),
    remove: (id: string) =>
      apiFetch<void>(`/api/variables/${id}`, { method: 'DELETE' }),
  },

  agentMemory: {
    listSessions: (params?: { limit?: number; offset?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.offset != null) q.set('offset', String(params.offset));
      if (params?.search?.trim()) q.set('search', params.search.trim());
      const suffix = q.size ? `?${q.toString()}` : '';
      return apiFetch<{
        items: Array<{
          sessionId: string;
          messageCount: number;
          firstMessageAt: string;
          lastMessageAt: string;
        }>;
        total: number;
        limit: number;
        offset: number;
      }>(`/api/agent-memory/sessions${suffix}`);
    },
    listSessionMessages: (
      sessionId: string,
      params?: { limit?: number; offset?: number },
    ) => {
      const q = new URLSearchParams();
      if (params?.limit != null) q.set('limit', String(params.limit));
      if (params?.offset != null) q.set('offset', String(params.offset));
      const suffix = q.size ? `?${q.toString()}` : '';
      return apiFetch<{
        sessionId: string;
        messages: Array<{
          id: string;
          role: string;
          content: string;
          createdAt: string;
          executionId?: string;
        }>;
        limit: number;
        offset: number;
      }>(`/api/agent-memory/sessions/${encodeURIComponent(sessionId)}/messages${suffix}`);
    },
    deleteSession: (sessionId: string) =>
      apiFetch<{ sessionId: string; deleted: number }>(
        `/api/agent-memory/sessions/${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      ),
    deleteMessage: (sessionId: string, messageId: string) =>
      apiFetch<void>(
        `/api/agent-memory/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
        { method: 'DELETE' },
      ),
  },

  executions: {

    listAll: (params?: { limit?: number; offset?: number; status?: string; workflowId?: string }) => {
      const q = new URLSearchParams();
      q.set('limit', String(params?.limit ?? 50));
      if (params?.offset) q.set('offset', String(params.offset));
      if (params?.status) q.set('status', params.status);
      if (params?.workflowId) q.set('workflowId', params.workflowId);
      return apiFetch<{
        items: Array<{
          id: string;
          workflowId: string;
          workflowName?: string;
          status: string;
          mode: string;
          startedAt?: string;
          finishedAt?: string;
        }>;
        total: number;
      }>(`/api/executions?${q}`);
    },

    list: (workflowId: string) =>
      apiFetch<{
        items: Array<{
          id: string;
          status: string;
          mode: string;
          workflowVersionId?: string;
          startedAt?: string;
          finishedAt?: string;
        }>;
        total: number;
      }>(`/api/workflows/${workflowId}/executions?limit=50`),

    get: (id: string) => apiFetch<ExecutionDetail>(`/api/executions/${id}`),

    resumeHitl: (
      executionId: string,
      body: {
        nodeId?: string;
        decision: 'approve' | 'reject';
        comment?: string;
        supplement?: string;
      },
    ) =>
      apiFetch<{ status: string; waitingNodeId?: string }>(
        `/api/executions/${executionId}/hitl/resume`,
        { method: 'POST', body: JSON.stringify(body) },
      ),

    getDebugPinData: (id: string) =>
      apiFetch<{
        sourceExecutionId: string;
        failedNodeId?: string;
        skippedNodeIds: string[];
        pinData: Record<string, { json: Record<string, unknown> }[]>;
      }>(`/api/executions/${id}/debug-pin-data`),

  },

  preferences: {
    get: () =>
      apiFetch<{
        locale: string;
        themePreference: string;
        themeId: string;
        executionEnvironment: string;
      }>('/api/users/me/preferences'),
    patch: (body: Partial<{
      locale: string;
      themePreference: string;
      themeId: string;
      executionEnvironment: string;
    }>) =>
      apiFetch<{
        locale: string;
        themePreference: string;
        themeId: string;
        executionEnvironment: string;
      }>('/api/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  profile: {
    patch: (body: { nickname?: string; avatarUrl?: string | null }) =>
      apiFetch<AuthUser>('/api/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  themes: {
    list: () => apiFetch<{ themes: string[] }>('/api/themes').then((r) => r.themes),
    tokens: (themeId: string) =>
      apiFetch<{ tokens: Record<string, string> }>(`/api/themes/${themeId}`).then(
        (r) => r.tokens,
      ),
  },

  templates: {
    list: () =>
      apiFetch<{
        templates: Array<{
          id: string;
          name: string;
          description: string;
          category: 'automation' | 'agent';
        }>;
      }>(
        '/api/templates',
      ).then((r) => r.templates),
    clone: (id: string) =>
      apiFetch<{ id: string }>(`/api/templates/${id}/clone`, { method: 'POST' }),
  },

  credentials: {
    listTypes: () =>
      apiFetch<{
        types: Array<{
          id: string;
          displayName: string;
          description?: string;
          fields: Array<{
            key: string;
            label: string;
            type: 'text' | 'secret' | 'select';
            required?: boolean;
            placeholder?: string;
            options?: string[];
            defaultValue?: string;
          }>;
        }>;
      }>('/api/credentials/types'),
    list: () =>
      apiFetch<Array<{ id: string; name: string; type: string }>>('/api/credentials'),
    create: (body: { name: string; type: string; data: Record<string, unknown> }) =>
      apiFetch<{ id: string }>('/api/credentials', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    test: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/credentials/${id}/test`, { method: 'POST' }),
    remove: (id: string) =>
      apiFetch<void>(`/api/credentials/${id}`, { method: 'DELETE' }),
  },

  runners: {

    list: () =>

      apiFetch<{ runners: RunnerSummary[] }>('/api/runners').then((r) => r.runners),

    createRegistrationToken: (body?: { expiresInHours?: number; labels?: string[] }) =>
      apiFetch<{ registrationToken: string; expiresAt: string }>(
        '/api/runners/registration-tokens',
        {
          method: 'POST',
          body: JSON.stringify(body ?? {}),
        },
      ),

  },

  i18n: (locale: string) =>

    apiFetch<{ messages: Record<string, string> }>(`/api/i18n/${locale}`).then((r) => r.messages),

  chatSessions: () =>
    apiFetch<{ sessions: ChatSessionSummary[] }>('/api/chat/sessions').then((r) => r.sessions),

  createChatSession: (body: {
    title: string;
    mode?: 'chat' | 'rag';
    knowledgeBaseIds?: string[];
    ragTemplate?: string;
    botId?: string;
  }) =>
    apiFetch<ChatSessionSummary>('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patchChatSession: (
    sessionId: string,
    body: Partial<{
      title: string;
      mode: 'chat' | 'rag';
      knowledgeBaseIds: string[];
      ragTemplate: string;
      modelId: string | null;
    }>,
  ) =>
    apiFetch<ChatSessionSummary>(`/api/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  chatMessages: (sessionId: string) =>
    apiFetch<{ messages: ChatMessage[] }>(`/api/chat/sessions/${sessionId}/messages`).then(
      (r) => r.messages,
    ),

  setChatMessageFeedback: (sessionId: string, messageId: string, feedback: 'up' | 'down') =>
    apiFetch<void>(`/api/chat/sessions/${sessionId}/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  deleteChatSession: (sessionId: string) =>
    apiFetch<void>(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' }),

  models: {
    list: (capability?: string) => {
      const q = capability ? `?capability=${encodeURIComponent(capability)}` : '';
      return apiFetch<{ models: ModelSummary[] }>(`/api/models${q}`).then((r) => r.models);
    },
    listProviders: () =>
      apiFetch<{ providers: ModelProviderSummary[] }>('/api/models/providers').then(
        (r) => r.providers,
      ),
    createProvider: (body: {
      name: string;
      kind: ModelProviderKind;
      baseUrl: string;
      credentialId?: string | null;
      enabled?: boolean;
    }) =>
      apiFetch<ModelProviderSummary>('/api/models/providers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    sync: (providerId: string) =>
      apiFetch<{ ok: boolean }>('/api/models/sync', {
        method: 'POST',
        body: JSON.stringify({ providerId }),
      }),
    update: (id: string, body: { isDefaultChat?: boolean; isDefaultWorkflow?: boolean; enabled?: boolean }) =>
      apiFetch<ModelSummary>(`/api/models/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    healthCheckProvider: (id: string) =>
      apiFetch<ModelProviderSummary>(`/api/models/providers/${id}/health-check`, {
        method: 'POST',
      }),
  },

  knowledgeBases: {
    list: (scope?: 'mine' | 'shared' | 'all') => {
      const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
      return apiFetch<{ items: KnowledgeBaseSummary[] }>(`/api/knowledge-bases${q}`).then(
        (r) => r.items,
      );
    },
    get: (id: string) => apiFetch<KnowledgeBaseSummary>(`/api/knowledge-bases/${id}`),
    create: (body: { name: string; description?: string; embeddingModel?: string }) =>
      apiFetch<KnowledgeBaseSummary>('/api/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    patch: (
      id: string,
      body: {
        name?: string;
        description?: string;
        embeddingModel?: string;
        chunkSize?: number;
        chunkOverlap?: number;
        topK?: number;
        similarityThreshold?: number;
        hybridSearchEnabled?: boolean;
      },
    ) =>
      apiFetch<KnowledgeBaseSummary>(`/api/knowledge-bases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    reindexAll: (id: string) =>
      apiFetch<{ queued: number }>(`/api/knowledge-bases/${id}/reindex-all`, {
        method: 'POST',
      }),
    listCollaborators: (knowledgeBaseId: string) =>
      apiFetch<KnowledgeCollaboratorsResponse>(
        `/api/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/collaborators`,
      ),
    updateCollaborators: (
      knowledgeBaseId: string,
      collaborators: Array<{ userId: string; role: WorkflowCollaboratorRole }>,
    ) =>
      apiFetch<KnowledgeCollaboratorsResponse>(
        `/api/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/collaborators`,
        {
          method: 'PUT',
          body: JSON.stringify({ collaborators }),
        },
      ),
    listCollaboratorCandidates: (knowledgeBaseId: string) =>
      apiFetch<{ users: Array<{ id: string; email: string }> }>(
        `/api/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/collaborators/candidates`,
      ).then((r) => r.users),
    remove: (id: string) =>
      apiFetch<void>(`/api/knowledge-bases/${id}`, { method: 'DELETE' }),
    listDocuments: (id: string) =>
      apiFetch<{ items: KnowledgeDocumentSummary[] }>(`/api/knowledge-bases/${id}/documents`).then(
        (r) => r.items,
      ),
    uploadDocument: async (id: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch(`/api/knowledge-bases/${id}/documents`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<KnowledgeDocumentSummary>;
    },
    uploadDocumentBase64: (
      id: string,
      body: { fileName: string; mimeType: string; contentBase64: string },
    ) =>
      apiFetch<KnowledgeDocumentSummary>(`/api/knowledge-bases/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deleteDocument: (kbId: string, docId: string) =>
      apiFetch<void>(`/api/knowledge-bases/${kbId}/documents/${docId}`, { method: 'DELETE' }),
    reindex: (kbId: string, docId: string) =>
      apiFetch<KnowledgeDocumentSummary>(
        `/api/knowledge-bases/${kbId}/documents/${docId}/reindex`,
        { method: 'POST' },
      ),
    listChunks: (id: string, documentId?: string) => {
      const q = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
      return apiFetch<{ items: KnowledgeChunkPreview[] }>(
        `/api/knowledge-bases/${id}/chunks${q}`,
      ).then((r) => r.items);
    },
    query: (id: string, query: string) =>
      apiFetch<{
        hits: Array<{
          text: string;
          score: number;
          documentName: string;
          chunkIndex: number;
        }>;
      }>(`/api/knowledge-bases/${id}/query`, {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    updateMeta: (id: string, data: { name: string; description?: string }) =>
      apiFetch<KnowledgeBaseSummary>(`/api/knowledge-bases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    listSyncSources: (id: string) =>
      apiFetch<{ items: KnowledgeSyncSourceSummary[] }>(
        `/api/knowledge-bases/${id}/sync-sources`,
      ).then((r) => r.items),
    createSyncSource: (id: string, body: { path: string; enabled?: boolean }) =>
      apiFetch<KnowledgeSyncSourceSummary>(`/api/knowledge-bases/${id}/sync-sources`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'local_dir', ...body }),
      }),
    deleteSyncSource: (kbId: string, sourceId: string) =>
      apiFetch<void>(`/api/knowledge-bases/${kbId}/sync-sources/${sourceId}`, {
        method: 'DELETE',
      }),
    triggerSync: (kbId: string, sourceId: string) =>
      apiFetch<{ queued: boolean }>(
        `/api/knowledge-bases/${kbId}/sync-sources/${sourceId}/trigger`,
        { method: 'POST' },
      ),
  },

  chatBots: {
    list: () =>
      apiFetch<{ items: ChatBotSummary[] }>('/api/chat-bots').then((r) => r.items),
    get: (id: string) =>
      apiFetch<{ bot: ChatBotSummary; draft: ChatBotDraftConfig }>(`/api/chat-bots/${id}`),
    create: (body: { name: string; slug?: string; config?: Partial<ChatBotDraftConfig> }) =>
      apiFetch<ChatBotSummary>('/api/chat-bots', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: { name?: string; slug?: string; config?: Partial<ChatBotDraftConfig> }) =>
      apiFetch<{ bot: ChatBotSummary; draft: ChatBotDraftConfig }>(`/api/chat-bots/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    publish: (id: string) =>
      apiFetch<ChatBotSummary>(`/api/chat-bots/${id}/publish`, { method: 'POST' }),
    unpublish: (id: string) =>
      apiFetch<ChatBotSummary>(`/api/chat-bots/${id}/unpublish`, { method: 'POST' }),
    remove: (id: string) =>
      apiFetch<void>(`/api/chat-bots/${id}`, { method: 'DELETE' }),
    listChannels: (id: string) =>
      apiFetch<{ items: Array<{ channel: string; enabled: boolean }> }>(
        `/api/chat-bots/${id}/channels`,
      ).then((r) => r.items),
    setChannel: (id: string, channel: string, enabled: boolean) =>
      apiFetch<{ channel: string; enabled: boolean }>(
        `/api/chat-bots/${id}/channels/${channel}`,
        { method: 'PATCH', body: JSON.stringify({ enabled }) },
      ),
    listApiKeys: (id: string) =>
      apiFetch<{
        items: Array<{ id: string; name: string; scope: string; createdAt: string }>;
      }>(`/api/chat-bots/${id}/api-keys`).then((r) => r.items),
    createApiKey: (id: string, name: string) =>
      apiFetch<{ id: string; name: string; key: string }>(`/api/chat-bots/${id}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    deleteApiKey: (botId: string, keyId: string) =>
      apiFetch<void>(`/api/chat-bots/${botId}/api-keys/${keyId}`, { method: 'DELETE' }),
    createPublishedSession: (id: string) =>
      apiFetch<ChatSessionSummary>(`/api/chat-bots/${id}/sessions`, { method: 'POST' }),
    publishLog: (id: string) =>
      apiFetch<{
        items: Array<{
          id: string;
          action: string;
          versionId: string | null;
          detail: Record<string, unknown>;
          userId: string;
          createdAt: string;
        }>;
      }>(`/api/chat-bots/${id}/publish-log`).then((r) => r.items),
    generateConfig: (id: string, prompt: string) =>
      apiFetch<{ config: ChatBotDraftConfig; explanation: string }>(
        `/api/chat-bots/${id}/generate-config`,
        { method: 'POST', body: JSON.stringify({ prompt }) },
      ),
  },

  setupChecklist: () =>

    apiFetch<{ complete: boolean; items: Array<{ id: string; label: string; done: boolean }> }>(

      '/api/setup/checklist',

    ),

  mcpServers: {
    list: () =>
      apiFetch<{ servers: McpServer[] }>('/api/mcp-servers').then((r) => r.servers),
    create: (body: {
      name: string;
      transport: 'npx' | 'docker' | 'http';
      command?: string;
      args?: string[];
      url?: string;
      docker?: McpDockerConfig;
    }) =>
      apiFetch<McpServer>('/api/mcp-servers', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    remove: (id: string) =>
      apiFetch<void>(`/api/mcp-servers/${id}`, { method: 'DELETE' }),
    test: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/mcp-servers/${id}/test`, { method: 'POST' }),
    tools: (id: string) =>
      apiFetch<{ tools: string[]; source?: string }>(`/api/mcp-servers/${id}/tools`).then(
        (r) => r.tools,
      ),
  },

  skills: {
    list: () =>
      apiFetch<{ items: SkillRecordSummary[] }>('/api/skills').then((r) => r.items),
    get: (id: string) => apiFetch<SkillRecordSummary>(`/api/skills/${id}`),
    scan: (body: { workspaceRoot?: string; runnerId?: string }) =>
      apiFetch<{ skillsFound: number; items: Array<{ skillRelPath: string; name: string }> }>(
        '/api/skills/scan',
        { method: 'POST', body: JSON.stringify(body) },
      ),
    import: (body: {
      sourcePath: string;
      workspaceRoot?: string;
      skillName?: string;
      sourceFormat?: string;
      overwrite?: boolean;
    }) =>
      apiFetch<{ skill: SkillRecordSummary; skillRelPath: string; skillPath: string }>(
        '/api/skills/import',
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },

  rxwfWorkspace: {
    get: () => apiFetch<{ workspaceRoot: string }>('/api/rxwf/workspace'),
    put: (workspaceRoot: string) =>
      apiFetch<{ ok: boolean; workspaceRoot: string }>('/api/rxwf/workspace', {
        method: 'PUT',
        body: JSON.stringify({ workspaceRoot }),
      }),
  },

  rxwfCatalog: {
    hooks: (workspaceRoot?: string) => {
      const q = workspaceRoot ? `?workspaceRoot=${encodeURIComponent(workspaceRoot)}` : '';
      return apiFetch<{ items: unknown[] }>(`/api/rxwf-catalog/hooks${q}`);
    },
    commands: (workspaceRoot?: string) => {
      const q = workspaceRoot ? `?workspaceRoot=${encodeURIComponent(workspaceRoot)}` : '';
      return apiFetch<{ items: unknown[] }>(`/api/rxwf-catalog/commands${q}`);
    },
    workflows: (workspaceRoot?: string) => {
      const q = workspaceRoot ? `?workspaceRoot=${encodeURIComponent(workspaceRoot)}` : '';
      return apiFetch<{ items: unknown[] }>(`/api/rxwf-catalog/workflows${q}`);
    },
    compileByPath: (body: {
      relPath: string;
      workspaceRoot?: string;
      compileMode?: 'linear_skillRun' | 'subagent_satellite';
    }) =>
      apiFetch<{
        definition: WorkflowDefinition;
        meta?: Record<string, unknown>;
        relPath: string;
      }>('/api/rxwf-catalog/workflows/compile-by-path', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  instructionContexts: {
    resolve: (body: {
      workspaceRoot?: string;
      ruleMode?: 'off' | 'inherit' | 'explicit';
      ruleSources?: string[];
      ruleExplicitPaths?: string[];
      contextPaths?: string[];
      maxRuleTokens?: number;
    }) =>
      apiFetch<{
        merged: string;
        tokenEstimate: number;
        contexts: Array<{ relativePath: string; sourceFormat: string; priority: number }>;
      }>('/api/instruction-contexts/resolve', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  plugins: {
    list: () =>
      apiFetch<{ plugins: PluginSummary[] }>('/api/plugins').then((r) => r.plugins),
    register: (manifest: string, signature: string) =>
      apiFetch<{ ok: boolean; id: string; type: string }>('/api/plugins/register', {
        method: 'POST',
        body: JSON.stringify({ manifest, signature }),
      }),
    enable: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/plugins/${id}/enable`, { method: 'POST' }),
    disable: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/plugins/${id}/disable`, { method: 'POST' }),
  },

  mcpTokens: {
    list: () =>
      apiFetch<{ tokens: McpTokenSummary[] }>('/api/mcp-tokens').then((r) => r.tokens),
    create: (name: string) =>
      apiFetch<{
        id: string;
        name: string;
        token: string;
        mcpJson: Record<string, unknown>;
      }>('/api/mcp-tokens', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    revoke: (id: string) =>
      apiFetch<void>(`/api/mcp-tokens/${id}`, { method: 'DELETE' }),
  },

  admin: {
    putI18n: (locale: string, messages: Record<string, string>) =>
      apiFetch<{ ok: boolean }>(`/api/admin/i18n/${locale}`, {
        method: 'PUT',
        body: JSON.stringify({ messages }),
      }),
    putTheme: (theme: string, tokens: Record<string, string>) =>
      apiFetch<{ ok: boolean }>(`/api/admin/themes/${theme}`, {
        method: 'PUT',
        body: JSON.stringify({ tokens }),
      }),
  },

};

export interface McpDockerConfig {
  image?: string;
  args?: string[];
  volumes?: string[];
  env?: Record<string, string>;
  network?: string;
}

export interface McpServer {
  id: string;
  name: string;
  transport: 'npx' | 'docker' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  docker?: McpDockerConfig;
}

export interface McpTokenSummary {
  id: string;
  name: string;
  createdAt: string;
}

export interface PluginSummary {
  id: string;
  type: string;
  enabled: boolean;
  version: number;
}

export interface SkillRecordSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sourceFormat: string;
  version: string;
  status: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RunnerSummary {
  id: string;
  name: string;
  kind: string;
  platform: { os: string; arch: string };
  status: string;
  capabilities?: string[];
  maxConcurrent: number;
  runningJobs: number;
  labels: string[];
  agentVersion: string | null;
  lastHeartbeatAt: string | null;
  crewaiSidecarUrl?: string | null;
}


