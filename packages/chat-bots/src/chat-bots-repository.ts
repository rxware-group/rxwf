import type {
  ChatBotChannelKind,
  ChatBotChannelRecord,
  ChatBotConfig,
  ChatBotPublishLogRecord,
  ChatBotRecord,
  ChatBotStatus,
  ChatBotApiKeyRecord,
  ChatBotVersionRecord,
} from './types.js';

export interface ChatBotsRepository {
  createBot(input: {
    id: string;
    ownerUserId: string;
    name: string;
    slug: string;
    status?: ChatBotStatus;
  }): Promise<ChatBotRecord>;

  getBot(id: string, ownerUserId: string): Promise<ChatBotRecord | null>;
  getBotById(id: string): Promise<ChatBotRecord | null>;
  getBotBySlug(slug: string): Promise<ChatBotRecord | null>;
  listBots(ownerUserId: string): Promise<ChatBotRecord[]>;
  updateBot(
    id: string,
    ownerUserId: string,
    patch: Partial<Pick<ChatBotRecord, 'name' | 'slug'>>,
  ): Promise<ChatBotRecord | null>;
  deleteBot(id: string, ownerUserId: string): Promise<boolean>;
  setBotPublished(
    id: string,
    ownerUserId: string,
    publishedVersionId: string | null,
    status: ChatBotStatus,
  ): Promise<ChatBotRecord | null>;

  createVersion(input: {
    id: string;
    botId: string;
    version: number;
    config: ChatBotConfig;
    publishedAt: Date | null;
    createdBy: string;
  }): Promise<ChatBotVersionRecord>;

  getVersion(id: string): Promise<ChatBotVersionRecord | null>;
  getDraftVersion(botId: string): Promise<ChatBotVersionRecord | null>;
  updateDraftVersion(
    botId: string,
    config: ChatBotConfig,
  ): Promise<ChatBotVersionRecord | null>;
  getNextVersionNumber(botId: string): Promise<number>;

  listChannels(botId: string): Promise<ChatBotChannelRecord[]>;
  upsertChannel(
    botId: string,
    channel: ChatBotChannelKind,
    enabled: boolean,
    config: Record<string, unknown>,
  ): Promise<ChatBotChannelRecord>;

  appendPublishLog(
    input: Omit<ChatBotPublishLogRecord, 'createdAt'>,
  ): Promise<ChatBotPublishLogRecord>;

  listPublishLog(botId: string, limit?: number): Promise<ChatBotPublishLogRecord[]>;

  /** Published bots with MCP channel enabled (for dynamic MCP tool registration). */
  listMcpEnabledPublished(): Promise<
    Array<{ slug: string; toolName: string; description: string }>
  >;

  createApiKey(input: {
    id: string;
    botId: string;
    keyHash: string;
    name: string;
    scope: string;
    expiresAt: Date | null;
  }): Promise<ChatBotApiKeyRecord>;

  listApiKeys(botId: string): Promise<ChatBotApiKeyRecord[]>;
  deleteApiKey(id: string, botId: string): Promise<boolean>;
  findBotByApiKeyHash(keyHash: string): Promise<{ botId: string; keyId: string } | null>;
  touchApiKeyLastUsed(id: string): Promise<void>;
}
