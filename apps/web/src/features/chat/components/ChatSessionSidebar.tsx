import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import { api, type ChatSessionSummary } from '../../../api/client.js';
import { t } from '../chat-labels.js';

type SessionWithDates = ChatSessionSummary & { updatedAt?: string; createdAt?: string };

interface ChatSessionSidebarProps {
  sessions: ChatSessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSessionsChange: (sessions: ChatSessionSummary[]) => void;
  labels?: Record<string, string>;
}

type DateGroup = 'today' | 'yesterday' | 'earlier';

function sessionTimestamp(session: SessionWithDates): number {
  const raw = session.updatedAt ?? session.createdAt;
  return raw ? new Date(raw).getTime() : 0;
}

function sessionDateGroup(session: SessionWithDates): DateGroup {
  const raw = session.updatedAt ?? session.createdAt;
  if (!raw) return 'earlier';

  const date = new Date(raw);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  return 'earlier';
}

function groupSessions(sessions: ChatSessionSummary[]): Record<DateGroup, ChatSessionSummary[]> {
  const sorted = [...sessions].sort(
    (a, b) => sessionTimestamp(b as SessionWithDates) - sessionTimestamp(a as SessionWithDates),
  );
  const groups: Record<DateGroup, ChatSessionSummary[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const session of sorted) {
    groups[sessionDateGroup(session as SessionWithDates)].push(session);
  }
  return groups;
}

export function ChatSessionSidebar({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onSessionsChange,
  labels: labelsProp,
}: ChatSessionSidebarProps) {
  const labels = labelsProp ?? {};

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  const groupLabel = (group: DateGroup) => {
    if (group === 'today') return t(labels, 'chat.sidebar.today');
    if (group === 'yesterday') return t(labels, 'chat.sidebar.yesterday');
    return t(labels, 'chat.sidebar.earlier');
  };

  const startRename = useCallback((session: ChatSessionSummary) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  }, []);

  const commitRename = useCallback(
    async (sessionId: string) => {
      const trimmed = editTitle.trim();
      setEditingId(null);
      if (!trimmed) return;

      const updated = await api.patchChatSession(sessionId, { title: trimmed });
      onSessionsChange(
        sessions.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s)),
      );
    },
    [editTitle, onSessionsChange, sessions],
  );

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRename(sessionId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleDelete = useCallback(
    async (session: ChatSessionSummary) => {
      const msg = t(labels, 'chat.sidebar.deleteConfirm', { title: session.title });
      if (!confirm(msg)) return;
      await api.deleteChatSession(session.id);
      onSessionsChange(sessions.filter((s) => s.id !== session.id));
    },
    [labels, onSessionsChange, sessions],
  );

  const groupOrder: DateGroup[] = ['today', 'yesterday', 'earlier'];

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2 className="chat-sidebar-title">{t(labels, 'chat.sidebar.title')}</h2>
        <button type="button" className="btn-primary chat-sidebar-new" onClick={onCreate}>
          {t(labels, 'chat.sidebar.new')}
        </button>
      </div>

      <nav className="chat-sidebar-list" aria-label={t(labels, 'auto.t_b77b641e')}>
        {sessions.length === 0 && (
          <p className="muted chat-sidebar-empty">{t(labels, 'chat.sidebar.empty')}</p>
        )}
        {groupOrder.map((group) => {
          const items = grouped[group];
          if (items.length === 0) return null;
          return (
            <section key={group} className="chat-sidebar-group">
              <h3 className="chat-sidebar-group-label">{groupLabel(group)}</h3>
              <ul className="list-plain chat-sidebar-sessions">
                {items.map((session) => {
                  const isActive = session.id === activeId;
                  const isEditing = editingId === session.id;
                  return (
                    <li key={session.id} className={`chat-sidebar-item${isActive ? ' is-active' : ''}`}>
                      {isEditing ? (
                        <input
                          className="chat-sidebar-rename-input"
                          value={editTitle}
                          autoFocus
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => void commitRename(session.id)}
                          onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="chat-sidebar-item-btn"
                          onClick={() => onSelect(session.id)}
                          onDoubleClick={() => startRename(session)}
                        >
                          <span className="chat-sidebar-item-title">{session.title}</span>
                          {session.mode === 'rag' && (
                            <span className="chat-sidebar-item-badge">RAG</span>
                          )}
                        </button>
                      )}
                      {!isEditing && (
                        <div className="chat-sidebar-item-actions">
                          <button
                            type="button"
                            className="chat-sidebar-action"
                            title={t(labels, 'chat.sidebar.rename')}
                            aria-label={t(labels, 'chat.sidebar.rename')}
                            onClick={() => startRename(session)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="chat-sidebar-action chat-sidebar-action--danger"
                            title={t(labels, 'chat.sidebar.delete')}
                            aria-label={t(labels, 'chat.sidebar.delete')}
                            onClick={() => void handleDelete(session)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
