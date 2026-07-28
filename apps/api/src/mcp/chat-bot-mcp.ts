import type { ChatRepository } from '@rxwf/chat';
import type { ChatBotService } from '@rxwf/chat-bots';
import type { createChatService } from '@rxwf/chat';
import type { McpExtraTool } from '@rxwf/mcp-server';
import { runChatBotForMcp } from './run-chat-bot.js';

type ChatService = ReturnType<typeof createChatService>;

export interface ChatBotMcpBindings {
  chatBots: ChatBotService;
  chatService: ChatService;
  chatRepo: ChatRepository;
}

let bindings: ChatBotMcpBindings | undefined;

export function setChatBotMcpBindings(next: ChatBotMcpBindings): void {
  bindings = next;
}

export function getChatBotMcpBindings(): ChatBotMcpBindings | undefined {
  return bindings;
}

export function createChatBotMcpHandlers() {
  return {
    async listExtraTools(): Promise<McpExtraTool[]> {
      const b = getChatBotMcpBindings();
      if (!b) return [];
      const published = await b.chatBots.listMcpEnabledPublished();
      const tools: McpExtraTool[] = [
        {
          name: 'chat_bot_run',
          description: 'Run a published chat bot by slug (args: botSlug, message, sessionId?)',
        },
      ];
      const seen = new Set<string>(['chat_bot_run']);
      for (const row of published) {
        if (seen.has(row.toolName)) continue;
        seen.add(row.toolName);
        tools.push({ name: row.toolName, description: row.description });
      }
      return tools;
    },

    async callExtraTool(name: string, args: Record<string, unknown>): Promise<string> {
      const b = getChatBotMcpBindings();
      if (!b) {
        throw new Error('Chat bot MCP is not available (featurePlus required)');
      }
      const result = await runChatBotForMcp(
        b.chatBots,
        b.chatService,
        b.chatRepo,
        {
          botSlug: typeof args.botSlug === 'string' ? args.botSlug : undefined,
          message: typeof args.message === 'string' ? args.message : undefined,
          sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
        },
        name,
      );
      return JSON.stringify(result);
    },
  };
}
