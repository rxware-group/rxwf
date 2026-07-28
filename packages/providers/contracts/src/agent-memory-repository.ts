export type AgentMemoryRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMemoryMessageRecord {
  id: string;
  sessionId: string;
  role: AgentMemoryRole;
  content: string;
  executionId?: string;
  createdAt: Date;
}

export interface AgentMemoryAppendInput {
  sessionId: string;
  role: AgentMemoryRole;
  content: string;
  executionId?: string;
}

export interface AgentMemorySessionSummary {
  sessionId: string;
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
}

export interface AgentMemoryListSessionsOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AgentMemoryListMessagesOptions {
  limit?: number;
  offset?: number;
}

export interface AgentMemoryRepository {
  append(input: AgentMemoryAppendInput): Promise<AgentMemoryMessageRecord>;
  listRecent(sessionId: string, limit: number): Promise<AgentMemoryMessageRecord[]>;
  listSessions(
    options?: AgentMemoryListSessionsOptions,
  ): Promise<{ items: AgentMemorySessionSummary[]; total: number }>;
  listAllMessages(
    sessionId: string,
    options?: AgentMemoryListMessagesOptions,
  ): Promise<AgentMemoryMessageRecord[]>;
  deleteSession(sessionId: string): Promise<number>;
  deleteMessage(id: string): Promise<boolean>;
}
