import { useEffect, useRef } from 'react';

import type { ChatMessage } from '../chat-types.js';
import { t } from '../chat-labels.js';
import { LoadingHost } from '../../../components/LoadingHost.js';
import { ChatMessageBubble } from './ChatMessageBubble.js';
import type { ChatProcessingPhase } from '../../../api/client.js';

interface ChatMessageListProps {
  messages: ChatMessage[];
  /** When defined, renders a streaming assistant bubble at the end (may be empty string). */
  streamingText?: string | null;
  streamingPhase?: ChatProcessingPhase | null;
  loading?: boolean;
  labels?: Record<string, string>;
  sessionId?: string | null;
  onFeedback?: () => void;
  onRegenerate?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  streamingText,
  streamingPhase,
  loading,
  labels,
  sessionId,
  onFeedback,
  onRegenerate,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingPhase]);

  const visible = messages.filter((m) => m.role !== 'system');

  return (
    <LoadingHost
      loading={Boolean(loading && visible.length === 0)}
      className="loading-host chat-message-list agent-memory-chat"
      label={t(labels, 'chat.loading')}
    >
      {!loading && visible.length === 0 && !streamingText && (
        <p className="muted chat-message-list-empty">{t(labels, 'chat.empty')}</p>
      )}
      {visible.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          labels={labels}
          sessionId={sessionId ?? undefined}
          onFeedback={onFeedback}
          onRegenerate={onRegenerate}
        />
      ))}
      {streamingText != null && (
        <ChatMessageBubble
          message={{
            id: '__streaming__',
            sessionId: sessionId ?? '',
            role: 'assistant',
            content: streamingText,
            createdAt: new Date().toISOString(),
          }}
          streaming
          streamingPhase={streamingPhase}
          labels={labels}
        />
      )}
      <div ref={bottomRef} />
    </LoadingHost>
  );
}
