export type ChatBotStatus = 'draft' | 'published';
export type ChatBotChannelKind = 'api' | 'embed' | 'mcp';
export type ChatSessionKind = 'user' | 'public';

export interface ChatBotConfig {
  systemPrompt: string;
  openingMessage: string;
  avatarUrl?: string;
  themeColor: string;
  modelId: string;
  mode: 'chat' | 'rag';
  knowledgeBaseIds: string[];
  ragTemplate: 'support' | 'code';
  fallbackToChat: boolean;
  accessPolicy: 'public' | 'authenticated' | 'role';
  allowedRoles?: string[];
}

export const DEFAULT_CHAT_BOT_CONFIG: ChatBotConfig = {
  systemPrompt: '',
  openingMessage: '你好，有什么可以帮你？',
  themeColor: '#cc5de8',
  modelId: '',
  mode: 'rag',
  knowledgeBaseIds: [],
  ragTemplate: 'support',
  fallbackToChat: true,
  accessPolicy: 'public',
};

export interface ChatBotRecord {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  status: ChatBotStatus;
  publishedVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatBotVersionRecord {
  id: string;
  botId: string;
  version: number;
  config: ChatBotConfig;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface ChatBotChannelRecord {
  botId: string;
  channel: ChatBotChannelKind;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ChatBotPublishLogRecord {
  id: string;
  botId: string;
  versionId: string | null;
  action: string;
  detail: Record<string, unknown>;
  userId: string;
  createdAt: Date;
}

export interface ChatBotApiKeyRecord {
  id: string;
  botId: string;
  name: string;
  scope: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Effective runtime settings derived from session and/or published bot version. */
export interface ResolvedChatConfig {
  mode: 'chat' | 'rag';
  knowledgeBaseIds: string[];
  ragTemplate: string;
  systemPrompt: string;
  modelId: string | null;
  fallbackToChat: boolean;
}
