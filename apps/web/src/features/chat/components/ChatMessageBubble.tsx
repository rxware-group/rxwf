import { api } from '../../../api/client.js';
import type { ChatMessage } from '../chat-types.js';
import { t } from '../chat-labels.js';
import { CitationCard } from './CitationCard.js';
import { ChatMessageContent } from './ChatMessageContent.js';
import { ChatProcessingStatus } from './ChatProcessingStatus.js';
import type { ChatProcessingPhase } from '../../../api/client.js';
import { chatMessageRoleLabel, formatChatMessageTime } from '../chat-message-display.js';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
  streamingPhase?: ChatProcessingPhase | null;
  labels?: Record<string, string>;
  sessionId?: string;
  onFeedback?: () => void;
  onRegenerate?: (messageId: string) => void;
}

export function ChatMessageBubble({
  message,
  streaming,
  streamingPhase,
  labels,
  sessionId,
  onFeedback,
  onRegenerate,
}: ChatMessageBubbleProps) {
  if (message.role === 'system') return null;

  const isUser = message.role === 'user';
  const bubbleClassName = isUser
    ? 'chat-bubble chat-bubble--user'
    : 'chat-bubble chat-bubble--assistant';

  async function setFeedback(feedback: 'up' | 'down') {
    if (!sessionId || streaming) return;
    await api.setChatMessageFeedback(sessionId, message.id, feedback);
    onFeedback?.();
  }

  return (
    <div className={`agent-memory-chat-row agent-memory-chat-row--${message.role}`}>
      <div className="agent-memory-chat-block">
        <div className="agent-memory-chat-meta">
          <span className="agent-memory-chat-role">
            {chatMessageRoleLabel(labels, message.role)}
          </span>
          {!streaming && (
            <span className="agent-memory-chat-time">
              {formatChatMessageTime(message.createdAt)}
            </span>
          )}
        </div>
        <div className={bubbleClassName}>
          <div className="chat-bubble-content">
            {streaming && !message.content.trim() && streamingPhase ? (
              <ChatProcessingStatus phase={streamingPhase} labels={labels} />
            ) : isUser ? (
              <div className="chat-plain-text">{message.content}</div>
            ) : (
              <ChatMessageContent
                role={message.role}
                content={message.content}
                streaming={streaming}
              />
            )}
          </div>
          {!isUser && message.citations && message.citations.length > 0 && (
            <CitationCard
              citations={message.citations}
              title={t(labels, 'chat.citations.title')}
              labels={labels}
            />
          )}
          {!isUser && !streaming && sessionId && (
            <div className="chat-feedback-row">
              <button
                type="button"
                className={`chat-feedback-btn${message.feedback === 'up' ? ' is-active' : ''}`}
                onClick={() => void setFeedback('up')}
              >
                {t(labels, 'chat.feedback.up')}
              </button>
              <button
                type="button"
                className={`chat-feedback-btn${message.feedback === 'down' ? ' is-active' : ''}`}
                onClick={() => void setFeedback('down')}
              >
                {t(labels, 'chat.feedback.down')}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  className="chat-feedback-btn chat-feedback-btn--regenerate"
                  onClick={() => onRegenerate(message.id)}
                >
                  {t(labels, 'chat.regenerate')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
