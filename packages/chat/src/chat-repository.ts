export type ChatSessionMode = 'chat' | 'rag';

export interface ChatCitation {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export type ChatSessionKind = 'user' | 'public';

export interface ChatSessionRecord {
  id: string;
  userId: string;
  title: string;
  kind: ChatSessionKind;
  botId: string | null;
  botVersionId: string | null;
  publicClientToken: string | null;
  mode: ChatSessionMode;
  knowledgeBaseIds: string[];
  ragTemplate: string;
  systemPrompt: string;
  modelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: ChatCitation[];
  feedback?: 'up' | 'down' | null;
  createdAt: Date;
}

export interface ChatRepository {
  createSession(input: {
    id: string;
    userId: string;
    title: string;
    mode?: ChatSessionMode;
    knowledgeBaseIds?: string[];
    ragTemplate?: string;
    systemPrompt?: string;
    modelId?: string | null;
    kind?: ChatSessionKind;
    botId?: string | null;
    botVersionId?: string | null;
    publicClientToken?: string | null;
  }): Promise<ChatSessionRecord>;
  listSessions(userId: string): Promise<ChatSessionRecord[]>;
  getSession(id: string, userId: string): Promise<ChatSessionRecord | null>;
  getPublicSession(id: string, clientToken: string): Promise<ChatSessionRecord | null>;
  updateSession(
    id: string,
    userId: string,
    patch: Partial<
      Pick<
        ChatSessionRecord,
        | 'title'
        | 'mode'
        | 'knowledgeBaseIds'
        | 'ragTemplate'
        | 'systemPrompt'
        | 'modelId'
        | 'botId'
        | 'botVersionId'
      >
    >,
  ): Promise<ChatSessionRecord | null>;
  deleteSession(id: string, userId: string): Promise<boolean>;
  appendMessage(input: {
    id: string;
    sessionId: string;
    role: ChatMessageRecord['role'];
    content: string;
    citations?: ChatCitation[];
  }): Promise<ChatMessageRecord>;
  setMessageFeedback(
    messageId: string,
    sessionId: string,
    userId: string,
    feedback: 'up' | 'down',
  ): Promise<boolean>;
  /** Deletes the message and all messages created at or after it (by createdAt order). */
  deleteMessagesFrom(sessionId: string, fromMessageId: string): Promise<boolean>;
  listMessages(sessionId: string): Promise<ChatMessageRecord[]>;
}
