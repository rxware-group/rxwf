import { AwfError } from '@rxwf/shared';
import { generateBotApiKey, hashBotApiKey } from './api-keys.js';
import { configToResolved, mergeConfig } from './config.js';
import type { ChatBotsRepository } from './chat-bots-repository.js';
import { uniqueSlug } from './slug.js';
import {
  DEFAULT_CHAT_BOT_CONFIG,
  type ChatBotChannelKind,
  type ChatBotConfig,
  type ChatBotRecord,
  type ChatBotVersionRecord,
  type ResolvedChatConfig,
} from './types.js';

export function createChatBotService(deps: { repo: ChatBotsRepository }) {
  const { repo } = deps;

  return {
    listBots(ownerUserId: string) {
      return repo.listBots(ownerUserId);
    },

    async getBot(id: string, ownerUserId: string) {
      const bot = await repo.getBot(id, ownerUserId);
      if (!bot) throw new AwfError('E1001', 'Chat bot not found');
      return bot;
    },

    async getBotBySlug(slug: string) {
      const bot = await repo.getBotBySlug(slug);
      if (!bot) throw new AwfError('E1001', 'Chat bot not found');
      return bot;
    },

    async createBot(
      ownerUserId: string,
      input: { name: string; slug?: string; config?: Partial<ChatBotConfig> },
    ) {
      let slug: string;
      if (input.slug) {
        slug = slugifyOrThrow(input.slug);
        if (await repo.getBotBySlug(slug)) {
          throw new AwfError('E1004', 'Slug already in use');
        }
      } else {
        slug = await uniqueSlug(input.name, async (s) => Boolean(await repo.getBotBySlug(s)));
      }

      const id = crypto.randomUUID();
      const bot = await repo.createBot({
        id,
        ownerUserId,
        name: input.name.trim(),
        slug,
        status: 'draft',
      });

      const config = mergeConfig(DEFAULT_CHAT_BOT_CONFIG, input.config ?? {});
      await repo.createVersion({
        id: crypto.randomUUID(),
        botId: id,
        version: 1,
        config,
        publishedAt: null,
        createdBy: ownerUserId,
      });

      for (const channel of ['api', 'embed', 'mcp'] as const) {
        await repo.upsertChannel(id, channel, false, defaultChannelConfig(channel));
      }

      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        botId: id,
        versionId: null,
        action: 'created',
        detail: { slug },
        userId: ownerUserId,
      });

      return bot;
    },

    async updateBot(
      id: string,
      ownerUserId: string,
      patch: { name?: string; slug?: string },
    ) {
      if (patch.slug) {
        const other = await repo.getBotBySlug(patch.slug);
        if (other && other.id !== id) {
          throw new AwfError('E1004', 'Slug already in use');
        }
        patch.slug = slugifyOrThrow(patch.slug);
      }
      const updated = await repo.updateBot(id, ownerUserId, patch);
      if (!updated) throw new AwfError('E1001', 'Chat bot not found');
      return updated;
    },

    async deleteBot(id: string, ownerUserId: string) {
      const ok = await repo.deleteBot(id, ownerUserId);
      if (!ok) throw new AwfError('E1001', 'Chat bot not found');
    },

    async getDraftConfig(botId: string, ownerUserId: string): Promise<ChatBotConfig> {
      await this.getBot(botId, ownerUserId);
      const draft = await repo.getDraftVersion(botId);
      if (!draft) throw new AwfError('E1001', 'Draft version not found');
      return draft.config;
    },

    async updateDraftConfig(
      botId: string,
      ownerUserId: string,
      patch: Partial<ChatBotConfig>,
    ): Promise<ChatBotConfig> {
      await this.getBot(botId, ownerUserId);
      const draft = await repo.getDraftVersion(botId);
      if (!draft) throw new AwfError('E1001', 'Draft version not found');
      const next = mergeConfig(draft.config, patch);
      const updated = await repo.updateDraftVersion(botId, next);
      if (!updated) throw new AwfError('E1001', 'Draft version not found');
      return updated.config;
    },

    async publish(botId: string, ownerUserId: string): Promise<ChatBotRecord> {
      const bot = await this.getBot(botId, ownerUserId);
      const draft = await repo.getDraftVersion(botId);
      if (!draft) throw new AwfError('E1001', 'Draft version not found');

      const versionNum = await repo.getNextVersionNumber(botId);
      const versionId = crypto.randomUUID();
      const now = new Date();
      await repo.createVersion({
        id: versionId,
        botId,
        version: versionNum,
        config: draft.config,
        publishedAt: now,
        createdBy: ownerUserId,
      });

      const published = await repo.setBotPublished(botId, ownerUserId, versionId, 'published');
      if (!published) throw new AwfError('E1001', 'Chat bot not found');

      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        botId,
        versionId,
        action: 'published',
        detail: { version: versionNum },
        userId: ownerUserId,
      });

      return published;
    },

    async unpublish(botId: string, ownerUserId: string): Promise<ChatBotRecord> {
      await this.getBot(botId, ownerUserId);
      const updated = await repo.setBotPublished(botId, ownerUserId, null, 'draft');
      if (!updated) throw new AwfError('E1001', 'Chat bot not found');

      await repo.appendPublishLog({
        id: crypto.randomUUID(),
        botId,
        versionId: null,
        action: 'unpublished',
        detail: {},
        userId: ownerUserId,
      });

      return updated;
    },

    async getPublishedVersion(
      botId: string,
      ownerUserId: string,
    ): Promise<ChatBotVersionRecord | null> {
      const bot = await this.getBot(botId, ownerUserId);
      if (!bot.publishedVersionId) return null;
      return repo.getVersion(bot.publishedVersionId);
    },

    async resolvePublishedConfig(versionId: string): Promise<ResolvedChatConfig> {
      const version = await repo.getVersion(versionId);
      if (!version || !version.publishedAt) {
        throw new AwfError('E1005', 'Bot version is not published');
      }
      return configToResolved(version.config);
    },

    /** Apply bot draft (internal) or published snapshot to session fields. */
    async resolveForSession(input: {
      botId?: string | null;
      botVersionId?: string | null;
      ownerUserId?: string;
      sessionFallback: ResolvedChatConfig;
    }): Promise<ResolvedChatConfig> {
      if (input.botVersionId) {
        return this.resolvePublishedConfig(input.botVersionId);
      }
      if (input.botId && input.ownerUserId) {
        const draft = await this.getDraftConfig(input.botId, input.ownerUserId);
        return configToResolved(draft);
      }
      return input.sessionFallback;
    },

    listChannels(botId: string, ownerUserId: string) {
      return this.getBot(botId, ownerUserId).then(() => repo.listChannels(botId));
    },

    async setChannel(
      botId: string,
      ownerUserId: string,
      channel: ChatBotChannelKind,
      enabled: boolean,
      config?: Record<string, unknown>,
    ) {
      await this.getBot(botId, ownerUserId);
      return repo.upsertChannel(
        botId,
        channel,
        enabled,
        config ?? defaultChannelConfig(channel),
      );
    },

    async requirePublishedForChannel(slug: string, channel: ChatBotChannelKind) {
      const bot = await repo.getBotBySlug(slug);
      if (!bot || bot.status !== 'published' || !bot.publishedVersionId) {
        throw new AwfError('E1005', 'Bot is not published');
      }
      const channels = await repo.listChannels(bot.id);
      const row = channels.find((c) => c.channel === channel);
      if (!row?.enabled) {
        throw new AwfError('E1005', `Channel ${channel} is not enabled`);
      }
      const version = await repo.getVersion(bot.publishedVersionId);
      if (!version?.publishedAt) {
        throw new AwfError('E1005', 'Published version not found');
      }
      return { bot, version };
    },

    async createApiKey(botId: string, ownerUserId: string, name: string) {
      await this.getBot(botId, ownerUserId);
      const plaintext = generateBotApiKey();
      const record = await repo.createApiKey({
        id: crypto.randomUUID(),
        botId,
        keyHash: hashBotApiKey(plaintext),
        name: name.trim() || 'API Key',
        scope: `chat:bot:${botId}`,
        expiresAt: null,
      });
      return { ...record, key: plaintext };
    },

    listApiKeys(botId: string, ownerUserId: string) {
      return this.getBot(botId, ownerUserId).then(() => repo.listApiKeys(botId));
    },

    async deleteApiKey(botId: string, ownerUserId: string, keyId: string) {
      await this.getBot(botId, ownerUserId);
      const ok = await repo.deleteApiKey(keyId, botId);
      if (!ok) throw new AwfError('E1001', 'API key not found');
    },

    async verifyApiKey(authorization: string | undefined) {
      if (!authorization?.trim()) return null;
      const token = authorization.replace(/^Bearer\s+/i, '').trim();
      if (!token.startsWith('awf_bot_')) return null;
      const found = await repo.findBotByApiKeyHash(hashBotApiKey(token));
      if (!found) return null;
      const bot = await repo.getBotById(found.botId);
      if (!bot || bot.status !== 'published' || !bot.publishedVersionId) {
        throw new AwfError('E1005', 'Bot is not published');
      }
      await repo.touchApiKeyLastUsed(found.keyId);
      return bot;
    },

    listPublishLog(botId: string, ownerUserId: string, limit = 50) {
      return this.getBot(botId, ownerUserId).then(() => repo.listPublishLog(botId, limit));
    },

    listMcpEnabledPublished() {
      return repo.listMcpEnabledPublished();
    },

    async createOwnerSessionFromPublished(botId: string, ownerUserId: string) {
      const bot = await this.getBot(botId, ownerUserId);
      if (!bot.publishedVersionId) {
        throw new AwfError('E1005', 'Bot is not published');
      }
      const version = await repo.getVersion(bot.publishedVersionId);
      if (!version?.publishedAt) {
        throw new AwfError('E1005', 'Published version not found');
      }
      return { bot, version, config: configToResolved(version.config) };
    },
  };
}

export type ChatBotService = ReturnType<typeof createChatBotService>;

function slugifyOrThrow(raw: string): string {
  const slug = uniqueSlugSync(raw);
  if (!slug) throw new AwfError('E1004', 'Invalid slug');
  return slug;
}

function uniqueSlugSync(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function defaultChannelConfig(channel: 'api' | 'embed' | 'mcp'): Record<string, unknown> {
  if (channel === 'api') return { rateLimitPerMin: 60 };
  if (channel === 'embed') return { allowedOrigins: [], widgetTitle: 'Chat' };
  return { toolName: 'chat_bot_run', description: 'Run published chat bot' };
}
