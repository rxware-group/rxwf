import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppOutletContext } from '../../layout/app-outlet-context.js';
import { t } from './chat-labels.js';

import { api, type ChatSessionSummary, type KnowledgeBaseSummary } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';
import { ChatComposer } from './components/ChatComposer.js';
import { ChatMessageList } from './components/ChatMessageList.js';
import { ChatSessionSidebar } from './components/ChatSessionSidebar.js';
import { ModelSelector } from './components/ModelSelector.js';
import { useChatMessages } from './hooks/useChatMessages.js';
import { useChatStream } from './hooks/useChatStream.js';

export function ChatPage() {
  const { labels } = useOutletContext<AppOutletContext>();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'rag'>('chat');
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [ragTemplate, setRagTemplate] = useState<'support' | 'code'>('support');
  const [fallbackToChat, setFallbackToChat] = useState(true);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  const { messages, loading, appendMessage, setMessages } = useChatMessages(activeId);

  const reloadMessages = useCallback(() => {
    if (!activeId) return;
    void api.chatMessages(activeId).then(setMessages).catch(() => setMessages([]));
  }, [activeId, setMessages]);

  const handleBeforeRegenerate = useCallback(
    (assistantMessageId: string) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === assistantMessageId);
        if (idx < 0) return prev;
        return prev.slice(0, idx);
      });
    },
    [setMessages],
  );

  const { streamingText, streamingPhase, isStreaming, send, regenerate, stop } = useChatStream(activeId, {
    mode,
    modelId: active?.modelId ?? undefined,
    fallbackToChat: mode === 'rag' ? fallbackToChat : undefined,
    onDone: () => {
      reloadMessages();
    },
    onError: () => {
      reloadMessages();
    },
    onBeforeRegenerate: handleBeforeRegenerate,
  });

  const handleRegenerate = useCallback(
    (messageId: string) => {
      void regenerate(messageId);
    },
    [regenerate],
  );

  useEffect(() => {
    let cancelled = false;
    setSessionsLoading(true);
    void api
      .chatSessions()
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
        if (list.length > 0) {
          setActiveId((prev) => prev ?? list[0]!.id);
        }
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    void api.knowledgeBases.list().then(setKnowledgeBases).catch(() => setKnowledgeBases([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    setMode(active.mode ?? 'chat');
    setSelectedKbIds(active.knowledgeBaseIds ?? []);
    setRagTemplate((active.ragTemplate === 'code' ? 'code' : 'support') as 'support' | 'code');
  }, [active]);

  const handleSessionsChange = useCallback((next: ChatSessionSummary[]) => {
    setSessions(next);
    setActiveId((prev) => {
      if (prev && next.some((s) => s.id === prev)) return prev;
      return next[0]?.id ?? null;
    });
  }, []);

  async function createSession() {
    const s = await api.createChatSession({
      title: t(labels, 'chat.newSession'),
      mode,
      knowledgeBaseIds: mode === 'rag' ? selectedKbIds : [],
      ragTemplate,
    });
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
  }

  async function persistSessionSettings() {
    if (!activeId) return;
    await api.patchChatSession(activeId, {
      mode,
      knowledgeBaseIds: selectedKbIds,
      ragTemplate,
    });
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, mode, knowledgeBaseIds: selectedKbIds, ragTemplate } : s,
      ),
    );
  }

  async function handleSend(content: string) {
    if (!activeId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    appendMessage({
      id: `pending-user-${crypto.randomUUID()}`,
      sessionId: activeId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    });

    await persistSessionSettings();
    await send(trimmed);
  }

  function handleModelChange(modelId: string | null) {
    if (!activeId) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, modelId } : s)),
    );
  }

  if (sessionsLoading) {
    return (
      <LoadingHost
        loading
        className="chat-layout"
        label={t(labels, 'common.loading')}
      />
    );
  }

  return (
    <div className="chat-layout">
      <ChatSessionSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={() => void createSession()}
        onSessionsChange={handleSessionsChange}
        labels={labels}
      />

      <main className="chat-main">
        {!activeId ? (
          <EmptyState
            icon="chat"
            title={t(labels, 'chat.emptyTitle')}
            description={t(labels, 'chat.emptyDesc')}
            actions={
              <button type="button" className="btn-primary" onClick={() => void createSession()}>
                {t(labels, 'chat.newSession')}
              </button>
            }
          />
        ) : (
          <>
            <header className="chat-main-header">
              <div className="chat-main-header-top">
                <h2 className="chat-main-title">{active?.title ?? t(labels, 'chat.title')}</h2>
                <Link to="/chat/bots" className="btn-secondary rxwf-mr-inline">
                  {t(labels, 'chat.bots')}
                </Link>
                <ModelSelector
                  sessionId={activeId}
                  modelId={active?.modelId}
                  onModelChange={handleModelChange}
                  labels={labels}
                />
              </div>

              <div className="segmented chat-mode-segmented">
                <button
                  type="button"
                  className={mode === 'chat' ? 'is-active' : ''}
                  onClick={() => setMode('chat')}
                >
                  {t(labels, 'chat.mode.chat')}
                </button>
                <button
                  type="button"
                  className={mode === 'rag' ? 'is-active' : ''}
                  onClick={() => setMode('rag')}
                >
                  {t(labels, 'chat.mode.rag')}
                </button>
              </div>
            </header>

            {mode === 'rag' && (
              <section className="card chat-rag-panel">
                <p className="muted">{t(labels, 'chat.rag.selectKb')}</p>
                <div className="chat-rag-kb-list">
                  {knowledgeBases.map((kb) => {
                    const on = selectedKbIds.includes(kb.id);
                    return (
                      <button
                        key={kb.id}
                        type="button"
                        className={on ? 'btn-primary' : 'btn-secondary'}
                        onClick={() =>
                          setSelectedKbIds((ids) =>
                            on ? ids.filter((x) => x !== kb.id) : [...ids, kb.id],
                          )
                        }
                      >
                        {kb.name}
                      </button>
                    );
                  })}
                </div>
                <label className="chat-rag-field">
                  {t(labels, 'chat.rag.template')}
                  <Select
                    value={ragTemplate}
                    onChange={(value) => setRagTemplate(value as 'support' | 'code')}
                    options={[
                      { value: 'support', label: t(labels, 'chat.rag.template.support') },
                      { value: 'code', label: t(labels, 'chat.rag.template.code') },
                    ]}
                  />
                </label>
                <label className="chat-rag-field chat-rag-fallback">
                  <input
                    type="checkbox"
                    checked={fallbackToChat}
                    onChange={(e) => setFallbackToChat(e.target.checked)}
                  />{' '}
                  {t(labels, 'chat.rag.fallback')}
                </label>
              </section>
            )}

            <ChatMessageList
              messages={messages}
              streamingText={isStreaming ? streamingText : null}
              streamingPhase={isStreaming ? streamingPhase : null}
              loading={loading}
              labels={labels}
              sessionId={activeId}
              onFeedback={reloadMessages}
              onRegenerate={handleRegenerate}
            />

            <ChatComposer
              disabled={!activeId}
              isStreaming={isStreaming}
              onSend={(content) => void handleSend(content)}
              onStop={stop}
              labels={labels}
            />
          </>
        )}
      </main>
    </div>
  );
}
