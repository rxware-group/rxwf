import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { ChatBotsRepository } from '@rxwf/chat-bots';
import {
  DEFAULT_CHAT_BOT_CONFIG,
  type ChatBotChannelKind,
  type ChatBotConfig,
  type ChatBotStatus,
} from '@rxwf/chat-bots';
import type { StandardDatabase } from '../drizzle/client.js';
import {
  chatBotApiKeys,
  chatBotChannels,
  chatBotPublishLog,
  chatBotVersions,
  chatBots,
} from '../drizzle/schema.js';

export function createStandardChatBotsRepository(db: StandardDatabase): ChatBotsRepository {
  return {
    async createBot(input) {
      const now = new Date();
      await db.insert(chatBots).values({
        id: input.id,
        ownerUserId: input.ownerUserId,
        name: input.name,
        slug: input.slug,
        status: input.status ?? 'draft',
        publishedVersionId: null,
        createdAt: now,
        updatedAt: now,
      });
      return {
        id: input.id,
        ownerUserId: input.ownerUserId,
        name: input.name,
        slug: input.slug,
        status: (input.status ?? 'draft') as ChatBotStatus,
        publishedVersionId: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async getBot(id, ownerUserId) {
      const rows = await db
        .select()
        .from(chatBots)
        .where(and(eq(chatBots.id, id), eq(chatBots.ownerUserId, ownerUserId)))
        .limit(1);
      return rows[0] ? mapBot(rows[0]) : null;
    },

    async getBotById(id) {
      const rows = await db.select().from(chatBots).where(eq(chatBots.id, id)).limit(1);
      return rows[0] ? mapBot(rows[0]) : null;
    },

    async getBotBySlug(slug) {
      const rows = await db.select().from(chatBots).where(eq(chatBots.slug, slug)).limit(1);
      return rows[0] ? mapBot(rows[0]) : null;
    },

    async listBots(ownerUserId) {
      const rows = await db
        .select()
        .from(chatBots)
        .where(eq(chatBots.ownerUserId, ownerUserId))
        .orderBy(desc(chatBots.updatedAt));
      return rows.map(mapBot);
    },

    async updateBot(id, ownerUserId, patch) {
      const existing = await this.getBot(id, ownerUserId);
      if (!existing) return null;
      const now = new Date();
      const next = { ...existing, ...patch, updatedAt: now };
      await db
        .update(chatBots)
        .set({
          name: next.name,
          slug: next.slug,
          updatedAt: now,
        })
        .where(eq(chatBots.id, id));
      return next;
    },

    async deleteBot(id, ownerUserId) {
      const existing = await this.getBot(id, ownerUserId);
      if (!existing) return false;
      await db.delete(chatBotApiKeys).where(eq(chatBotApiKeys.botId, id));
      await db.delete(chatBotChannels).where(eq(chatBotChannels.botId, id));
      await db.delete(chatBotVersions).where(eq(chatBotVersions.botId, id));
      await db.delete(chatBotPublishLog).where(eq(chatBotPublishLog.botId, id));
      await db.delete(chatBots).where(eq(chatBots.id, id));
      return true;
    },

    async setBotPublished(id, ownerUserId, publishedVersionId, status) {
      const existing = await this.getBot(id, ownerUserId);
      if (!existing) return null;
      const now = new Date();
      await db
        .update(chatBots)
        .set({
          publishedVersionId,
          status,
          updatedAt: now,
        })
        .where(eq(chatBots.id, id));
      return {
        ...existing,
        publishedVersionId,
        status,
        updatedAt: now,
      };
    },

    async createVersion(input) {
      const now = new Date();
      await db.insert(chatBotVersions).values({
        id: input.id,
        botId: input.botId,
        version: input.version,
        configJson: JSON.stringify(input.config),
        publishedAt: input.publishedAt,
        createdBy: input.createdBy,
        createdAt: now,
      });
      return {
        id: input.id,
        botId: input.botId,
        version: input.version,
        config: input.config,
        publishedAt: input.publishedAt,
        createdBy: input.createdBy,
        createdAt: now,
      };
    },

    async getVersion(id) {
      const rows = await db
        .select()
        .from(chatBotVersions)
        .where(eq(chatBotVersions.id, id))
        .limit(1);
      return rows[0] ? mapVersion(rows[0]) : null;
    },

    async getDraftVersion(botId) {
      const rows = await db
        .select()
        .from(chatBotVersions)
        .where(and(eq(chatBotVersions.botId, botId), isNull(chatBotVersions.publishedAt)))
        .orderBy(desc(chatBotVersions.version))
        .limit(1);
      return rows[0] ? mapVersion(rows[0]) : null;
    },

    async updateDraftVersion(botId, config) {
      const draft = await this.getDraftVersion(botId);
      if (!draft) return null;
      await db
        .update(chatBotVersions)
        .set({ configJson: JSON.stringify(config) })
        .where(eq(chatBotVersions.id, draft.id));
      return { ...draft, config };
    },

    async getNextVersionNumber(botId) {
      const rows = await db
        .select({ version: chatBotVersions.version, publishedAt: chatBotVersions.publishedAt })
        .from(chatBotVersions)
        .where(eq(chatBotVersions.botId, botId));
      const published = rows.filter((r) => r.publishedAt != null);
      const max = published.length ? Math.max(...published.map((r) => r.version)) : 0;
      return max + 1;
    },

    async listChannels(botId) {
      const rows = await db
        .select()
        .from(chatBotChannels)
        .where(eq(chatBotChannels.botId, botId));
      return rows.map((r) => ({
        botId: r.botId,
        channel: r.channel as ChatBotChannelKind,
        enabled: r.enabled,
        config: JSON.parse(r.configJson) as Record<string, unknown>,
      }));
    },

    async upsertChannel(botId, channel, enabled, config) {
      await db
        .insert(chatBotChannels)
        .values({
          botId,
          channel,
          enabled,
          configJson: JSON.stringify(config),
        })
        .onConflictDoUpdate({
          target: [chatBotChannels.botId, chatBotChannels.channel],
          set: {
            enabled,
            configJson: JSON.stringify(config),
          },
        });
      return { botId, channel, enabled, config };
    },

    async appendPublishLog(input) {
      const now = new Date();
      await db.insert(chatBotPublishLog).values({
        id: input.id,
        botId: input.botId,
        versionId: input.versionId,
        action: input.action,
        detailJson: JSON.stringify(input.detail),
        userId: input.userId,
        createdAt: now,
      });
      return { ...input, createdAt: now };
    },

    async listPublishLog(botId, limit = 50) {
      const rows = await db
        .select()
        .from(chatBotPublishLog)
        .where(eq(chatBotPublishLog.botId, botId))
        .orderBy(desc(chatBotPublishLog.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        botId: r.botId,
        versionId: r.versionId,
        action: r.action,
        detail: parseDetail(r.detailJson),
        userId: r.userId,
        createdAt: r.createdAt,
      }));
    },

    async listMcpEnabledPublished() {
      const rows = await db
        .select({
          slug: chatBots.slug,
          configJson: chatBotChannels.configJson,
        })
        .from(chatBots)
        .innerJoin(
          chatBotChannels,
          and(
            eq(chatBotChannels.botId, chatBots.id),
            eq(chatBotChannels.channel, 'mcp'),
            eq(chatBotChannels.enabled, true),
          ),
        )
        .where(
          and(eq(chatBots.status, 'published'), sql`${chatBots.publishedVersionId} IS NOT NULL`),
        );
      return rows.map((r) => {
        const cfg = parseChannelConfig(r.configJson);
        const toolName =
          typeof cfg.toolName === 'string' && cfg.toolName.trim()
            ? cfg.toolName.trim()
            : 'chat_bot_run';
        const description =
          typeof cfg.description === 'string' && cfg.description.trim()
            ? cfg.description.trim()
            : `Run published bot ${r.slug}`;
        return { slug: r.slug, toolName, description };
      });
    },

    async createApiKey(input) {
      const now = new Date();
      await db.insert(chatBotApiKeys).values({
        id: input.id,
        botId: input.botId,
        keyHash: input.keyHash,
        name: input.name,
        scope: input.scope,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: now,
      });
      return {
        id: input.id,
        botId: input.botId,
        name: input.name,
        scope: input.scope,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: now,
      };
    },

    async listApiKeys(botId) {
      const rows = await db
        .select()
        .from(chatBotApiKeys)
        .where(eq(chatBotApiKeys.botId, botId))
        .orderBy(desc(chatBotApiKeys.createdAt));
      return rows.map((r) => ({
        id: r.id,
        botId: r.botId,
        name: r.name,
        scope: r.scope,
        expiresAt: r.expiresAt,
        lastUsedAt: r.lastUsedAt,
        createdAt: r.createdAt,
      }));
    },

    async deleteApiKey(id, botId) {
      const rows = await db
        .select({ id: chatBotApiKeys.id })
        .from(chatBotApiKeys)
        .where(and(eq(chatBotApiKeys.id, id), eq(chatBotApiKeys.botId, botId)))
        .limit(1);
      if (!rows[0]) return false;
      await db.delete(chatBotApiKeys).where(eq(chatBotApiKeys.id, id));
      return true;
    },

    async findBotByApiKeyHash(keyHash) {
      const rows = await db
        .select({ id: chatBotApiKeys.id, botId: chatBotApiKeys.botId, expiresAt: chatBotApiKeys.expiresAt })
        .from(chatBotApiKeys)
        .where(eq(chatBotApiKeys.keyHash, keyHash))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
      return { botId: row.botId, keyId: row.id };
    },

    async touchApiKeyLastUsed(id) {
      await db
        .update(chatBotApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(chatBotApiKeys.id, id));
    },
  };
}

function mapBot(row: typeof chatBots.$inferSelect) {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    slug: row.slug,
    status: row.status as ChatBotStatus,
    publishedVersionId: row.publishedVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVersion(row: typeof chatBotVersions.$inferSelect) {
  return {
    id: row.id,
    botId: row.botId,
    version: row.version,
    config: parseConfig(row.configJson),
    publishedAt: row.publishedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function parseDetail(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseChannelConfig(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseConfig(json: string): ChatBotConfig {
  try {
    const raw = JSON.parse(json) as Partial<ChatBotConfig>;
    return { ...DEFAULT_CHAT_BOT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CHAT_BOT_CONFIG };
  }
}
