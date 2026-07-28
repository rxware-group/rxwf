import type { ChatRepository } from '@rxwf/chat';
import type { ChatBotService } from '@rxwf/chat-bots';
import type { createChatService } from '@rxwf/chat';
import { AwfError } from '@rxwf/shared';

type ChatService = ReturnType<typeof createChatService>;

export async function runChatBotForMcp(
  chatBots: ChatBotService,
  chatService: ChatService,
  chatRepo: ChatRepository,
  input: { botSlug?: string; message?: string; sessionId?: string },
  toolName?: string,
): Promise<{ sessionId: string; answer: string; citations: unknown[] }> {
  const message = String(input.message ?? '').trim();
  if (!message) {
    throw new AwfError('E1004', 'message required');
  }

  let slug = String(input.botSlug ?? '').trim();
  if (!slug && toolName && toolName !== 'chat_bot_run') {
    const published = await chatBots.listMcpEnabledPublished();
    const match = published.find((b) => b.toolName === toolName);
    if (!match) {
      throw new AwfError('E1001', `MCP tool ${toolName} is not registered`);
    }
    slug = match.slug;
  }
  if (!slug) {
    throw new AwfError('E1004', 'botSlug required');
  }

  const { bot, version } = await chatBots.requirePublishedForChannel(slug, 'mcp');
  const cfg = version.config;

  let sessionId = input.sessionId ? String(input.sessionId) : undefined;
  if (sessionId) {
    const existing = await chatRepo.getSession(sessionId, bot.ownerUserId);
    if (!existing || existing.botId !== bot.id) {
      throw new AwfError('E1001', 'Chat session not found for this bot');
    }
  } else {
    const created = await chatService.createSession(bot.ownerUserId, bot.name, {
      mode: cfg.mode,
      knowledgeBaseIds: cfg.knowledgeBaseIds,
      ragTemplate: cfg.ragTemplate,
      systemPrompt: cfg.systemPrompt,
      modelId: cfg.modelId || null,
      botId: bot.id,
      botVersionId: version.id,
    });
    sessionId = created.id;
  }

  const { answer, citations } = await chatService.collectReply(
    sessionId,
    bot.ownerUserId,
    message,
    { mode: cfg.mode, fallbackToChat: cfg.fallbackToChat },
  );

  return { sessionId, answer, citations: citations ?? [] };
}
