import type { ChatBotConfig, ResolvedChatConfig } from './types.js';

export function configToResolved(config: ChatBotConfig): ResolvedChatConfig {
  return {
    mode: config.mode,
    knowledgeBaseIds: config.knowledgeBaseIds,
    ragTemplate: config.ragTemplate,
    systemPrompt: config.systemPrompt,
    modelId: config.modelId || null,
    fallbackToChat: config.fallbackToChat,
  };
}

export function mergeConfig(
  base: ChatBotConfig,
  patch: Partial<ChatBotConfig>,
): ChatBotConfig {
  return {
    ...base,
    ...patch,
    knowledgeBaseIds: patch.knowledgeBaseIds ?? base.knowledgeBaseIds,
    allowedRoles: patch.allowedRoles ?? base.allowedRoles,
  };
}
