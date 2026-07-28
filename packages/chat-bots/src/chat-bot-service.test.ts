import { describe, expect, it } from 'vitest';
import type { ChatBotsRepository } from './chat-bots-repository.js';
import { createChatBotService } from './chat-bot-service.js';
import {
  DEFAULT_CHAT_BOT_CONFIG,
  type ChatBotChannelRecord,
  type ChatBotConfig,
  type ChatBotPublishLogRecord,
  type ChatBotRecord,
  type ChatBotVersionRecord,
} from './types.js';

function memoryRepo(): ChatBotsRepository {
  const bots = new Map<string, ChatBotRecord>();
  const versions = new Map<string, ChatBotVersionRecord>();
  const channels = new Map<string, ChatBotChannelRecord>();
  const logs: ChatBotPublishLogRecord[] = [];

  const draftKey = (botId: string) => `draft:${botId}`;

  return {
    async createBot(input) {
      const now = new Date();
      const rec: ChatBotRecord = {
        ...input,
        status: input.status ?? 'draft',
        publishedVersionId: null,
        createdAt: now,
        updatedAt: now,
      };
      bots.set(input.id, rec);
      return rec;
    },
    async getBot(id, ownerUserId) {
      const b = bots.get(id);
      return b && b.ownerUserId === ownerUserId ? b : null;
    },
    async getBotBySlug(slug) {
      return [...bots.values()].find((b) => b.slug === slug) ?? null;
    },
    async listBots(ownerUserId) {
      return [...bots.values()].filter((b) => b.ownerUserId === ownerUserId);
    },
    async updateBot(id, ownerUserId, patch) {
      const b = await this.getBot(id, ownerUserId);
      if (!b) return null;
      const next = { ...b, ...patch, updatedAt: new Date() };
      bots.set(id, next);
      return next;
    },
    async deleteBot(id, ownerUserId) {
      const b = await this.getBot(id, ownerUserId);
      if (!b) return false;
      bots.delete(id);
      return true;
    },
    async setBotPublished(id, ownerUserId, publishedVersionId, status) {
      const b = await this.getBot(id, ownerUserId);
      if (!b) return null;
      const next = {
        ...b,
        publishedVersionId,
        status,
        updatedAt: new Date(),
      };
      bots.set(id, next);
      return next;
    },
    async createVersion(input) {
      const rec: ChatBotVersionRecord = {
        id: input.id,
        botId: input.botId,
        version: input.version,
        config: input.config,
        publishedAt: input.publishedAt,
        createdBy: input.createdBy,
        createdAt: new Date(),
      };
      versions.set(input.id, rec);
      if (!input.publishedAt) {
        versions.set(draftKey(input.botId), rec);
      }
      return rec;
    },
    async getVersion(id) {
      return versions.get(id) ?? null;
    },
    async getDraftVersion(botId) {
      return versions.get(draftKey(botId)) ?? null;
    },
    async updateDraftVersion(botId, config) {
      const draft = versions.get(draftKey(botId));
      if (!draft) return null;
      const next = { ...draft, config };
      versions.set(draftKey(botId), next);
      versions.set(draft.id, next);
      return next;
    },
    async getNextVersionNumber(botId) {
      const nums = [...versions.values()]
        .filter((v) => v.botId === botId && v.publishedAt)
        .map((v) => v.version);
      return (nums.length ? Math.max(...nums) : 0) + 1;
    },
    async listChannels(botId) {
      return [...channels.values()].filter((c) => c.botId === botId);
    },
    async upsertChannel(botId, channel, enabled, config) {
      const key = `${botId}:${channel}`;
      const rec = { botId, channel, enabled, config };
      channels.set(key, rec);
      return rec;
    },
    async appendPublishLog(input) {
      const rec = { ...input, createdAt: new Date() };
      logs.push(rec);
      return rec;
    },
    async listPublishLog(botId, limit = 50) {
      return logs.filter((l) => l.botId === botId).slice(0, limit);
    },
    async listMcpEnabledPublished() {
      const out: Array<{ slug: string; toolName: string; description: string }> = [];
      for (const b of bots.values()) {
        if (b.status !== 'published' || !b.publishedVersionId) continue;
        const ch = channels.get(`${b.id}:mcp`);
        if (!ch?.enabled) continue;
        const cfg = ch.config as { toolName?: string; description?: string };
        out.push({
          slug: b.slug,
          toolName: cfg.toolName?.trim() || 'chat_bot_run',
          description: cfg.description?.trim() || `Run published bot ${b.slug}`,
        });
      }
      return out;
    },
  };
}

describe('createChatBotService', () => {
  it('creates bot with draft config', async () => {
    const service = createChatBotService({ repo: memoryRepo() });
    const bot = await service.createBot('user-1', { name: 'Support Bot' });
    expect(bot.status).toBe('draft');
    expect(bot.slug).toMatch(/support-bot/);
    const draft = await service.getDraftConfig(bot.id, 'user-1');
    expect(draft.openingMessage).toBe(DEFAULT_CHAT_BOT_CONFIG.openingMessage);
  });

  it('publish locks published_version_id and creates published version', async () => {
    const repo = memoryRepo();
    const service = createChatBotService({ repo });
    const bot = await service.createBot('user-1', {
      name: 'KB Bot',
      config: { systemPrompt: 'You are helpful', mode: 'rag', knowledgeBaseIds: ['kb1'] },
    });
    await service.publish(bot.id, 'user-1');
    const published = await service.getBot(bot.id, 'user-1');
    expect(published.status).toBe('published');
    expect(published.publishedVersionId).toBeTruthy();

    const version = await repo.getVersion(published.publishedVersionId!);
    expect(version?.publishedAt).toBeTruthy();
    expect(version?.config.systemPrompt).toBe('You are helpful');

    const resolved = await service.resolvePublishedConfig(published.publishedVersionId!);
    expect(resolved.knowledgeBaseIds).toEqual(['kb1']);
  });

  it('unpublish clears published pointer', async () => {
    const service = createChatBotService({ repo: memoryRepo() });
    const bot = await service.createBot('user-1', { name: 'Temp' });
    await service.publish(bot.id, 'user-1');
    const unpublished = await service.unpublish(bot.id, 'user-1');
    expect(unpublished.status).toBe('draft');
    expect(unpublished.publishedVersionId).toBeNull();
  });
});
