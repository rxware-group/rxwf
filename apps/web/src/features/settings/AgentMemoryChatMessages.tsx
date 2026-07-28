import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { IconTrash } from '../editor/NodeToolbarIcons.js';
import { t, useLabels } from '../../i18n/labels.js';
import { formatAgentMemoryMessageContent } from './agent-memory-message-format.js';

const PAGE_SIZE = 20;
const SCROLL_LOAD_THRESHOLD_PX = 72;

export type AgentMemoryChatMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function roleLabel(labels: Record<string, string>, role: string): string {
  if (role === 'user') return t(labels, 'agentMemory.session.roleUser');
  if (role === 'assistant') return t(labels, 'agentMemory.session.roleAssistant');
  if (role === 'system') return t(labels, 'agentMemory.session.roleSystem');
  if (role === 'tool') return t(labels, 'agentMemory.session.roleTool');
  return role;
}

function bubbleClassName(role: string): string {
  return role === 'user'
    ? 'chat-bubble chat-bubble--user'
    : 'chat-bubble chat-bubble--assistant';
}

async function resolveSessionMessageCount(sessionId: string): Promise<number | null> {
  const result = await api.agentMemory.listSessions({ search: sessionId, limit: 50 });
  const match = result.items.find((item) => item.sessionId === sessionId);
  return match?.messageCount ?? null;
}

async function fetchMessageWindow(
  sessionId: string,
  offsetFromStart: number,
  limit: number,
): Promise<AgentMemoryChatMessage[]> {
  const result = await api.agentMemory.listSessionMessages(sessionId, {
    offset: offsetFromStart,
    limit,
  });
  return result.messages;
}

export function AgentMemoryChatMessages({
  sessionId,
  onTotalChange,
}: {
  sessionId: string;
  onTotalChange?: (total: number) => void;
}) {
  const labels = useLabels();
  const { confirm, dialog } = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const initialScrollDoneRef = useRef(false);
  const loadingOlderRef = useRef(false);

  const [messages, setMessages] = useState<AgentMemoryChatMessage[]>([]);
  const [offsetFromStart, setOffsetFromStart] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    initialScrollDoneRef.current = false;
    try {
      const total = await resolveSessionMessageCount(sessionId);
      if (total == null || total === 0) {
        setMessages([]);
        setTotalCount(0);
        setOffsetFromStart(0);
        setHasMoreOlder(false);
        onTotalChange?.(0);
        return;
      }

      const nextOffset = Math.max(0, total - PAGE_SIZE);
      const rows = await fetchMessageWindow(sessionId, nextOffset, total - nextOffset);
      setMessages(rows);
      setTotalCount(total);
      setOffsetFromStart(nextOffset);
      setHasMoreOlder(nextOffset > 0);
      onTotalChange?.(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [labels, onTotalChange, sessionId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder || loading) return;
    loadingOlderRef.current = true;
    const container = containerRef.current;
    if (container) {
      pendingScrollRestoreRef.current = container.scrollHeight;
    }

    setLoadingOlder(true);
    setError(null);
    try {
      const nextOffset = Math.max(0, offsetFromStart - PAGE_SIZE);
      const limit = offsetFromStart - nextOffset;
      const rows = await fetchMessageWindow(sessionId, nextOffset, limit);
      setMessages((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const prepend = rows.filter((item) => !existing.has(item.id));
        return [...prepend, ...prev];
      });
      setOffsetFromStart(nextOffset);
      setHasMoreOlder(nextOffset > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMoreOlder, labels, loading, offsetFromStart, sessionId]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (pendingScrollRestoreRef.current != null) {
      const previousHeight = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      container.scrollTop += container.scrollHeight - previousHeight;
      return;
    }

    if (!initialScrollDoneRef.current && messages.length > 0 && !loading) {
      container.scrollTop = container.scrollHeight;
      initialScrollDoneRef.current = true;
    }
  }, [loading, messages]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || loadingOlder || !hasMoreOlder) return;
    if (container.scrollTop <= SCROLL_LOAD_THRESHOLD_PX) {
      void loadOlder();
    }
  };

  const removeMessage = async (message: AgentMemoryChatMessage) => {
    const ok = await confirm({
      title: t(labels, 'common.delete'),
      message: t(labels, 'agentMemory.deleteMessageConfirm'),
      danger: true,
      confirmLabel: t(labels, 'common.delete'),
    });
    if (!ok) return;

    setError(null);
    try {
      await api.agentMemory.deleteMessage(sessionId, message.id);
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      setTotalCount((prev) => {
        const next = Math.max(0, prev - 1);
        onTotalChange?.(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading && messages.length === 0) {
    return <p className="hint">{t(labels, 'common.loading')}</p>;
  }

  if (!loading && messages.length === 0) {
    return <EmptyState title={t(labels, 'agentMemory.session.empty')} />;
  }

  return (
    <>
      {dialog}
      {error ? <p className="error agent-memory-chat-error">{error}</p> : null}
      <div
        ref={containerRef}
        className="agent-memory-chat"
        onScroll={handleScroll}
      >
        {loadingOlder ? (
          <p className="hint agent-memory-chat-top-hint">{t(labels, 'agentMemory.session.loadingOlder')}</p>
        ) : hasMoreOlder ? (
          <p className="hint agent-memory-chat-top-hint">{t(labels, 'agentMemory.session.loadOlder')}</p>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          const text = formatAgentMemoryMessageContent(message.content, message.role);
          return (
            <div
              key={message.id}
              className={`agent-memory-chat-row agent-memory-chat-row--${message.role}`}
            >
              <div className="agent-memory-chat-block">
                <div className="agent-memory-chat-meta">
                  <span className="agent-memory-chat-role">{roleLabel(labels, message.role)}</span>
                  <span className="agent-memory-chat-time">{formatDateTime(message.createdAt)}</span>
                </div>
                <div className={bubbleClassName(message.role)}>
                  <button
                    type="button"
                    className="agent-memory-chat-delete"
                    aria-label={t(labels, 'common.delete')}
                    title={t(labels, 'common.delete')}
                    onClick={() => void removeMessage(message)}
                  >
                    <IconTrash />
                  </button>
                  <div className="chat-bubble-content chat-plain-text">{text}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export { PAGE_SIZE as AGENT_MEMORY_CHAT_PAGE_SIZE };
