import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { api } from '../../api/client.js';
import { ModalCloseButton } from '../../components/ModalCloseButton.js';
import type { AppOutletContext } from '../../layout/app-outlet-context.js';
import { t } from '../chat/chat-labels.js';
import { ChatComposer } from '../chat/components/ChatComposer.js';
import { ChatMessageList } from '../chat/components/ChatMessageList.js';
import { useChatMessages } from '../chat/hooks/useChatMessages.js';
import { useChatStream } from '../chat/hooks/useChatStream.js';

function sessionStorageKey(workflowId: string) {
  return `rxwf-editor-chat:${workflowId}`;
}

interface EditorChatSidebarProps {
  workflowId: string;
  workflowName: string;
  widthPx: number;
  onClose: () => void;
}

export function EditorChatSidebar({
  workflowId,
  workflowName,
  widthPx,
  onClose,
}: EditorChatSidebarProps) {
  const { labels } = useOutletContext<AppOutletContext>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const { messages, loading, setMessages } = useChatMessages(sessionId);

  const reloadMessages = useCallback(() => {
    if (!sessionId) return;
    void api.chatMessages(sessionId).then(setMessages).catch(() => setMessages([]));
  }, [sessionId, setMessages]);

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

  const { streamingText, isStreaming, send, regenerate, stop } = useChatStream(sessionId, {
    onDone: reloadMessages,
    onBeforeRegenerate: handleBeforeRegenerate,
  });

  useEffect(() => {
    if (!workflowId || workflowId === 'new') return;

    const boot = async () => {
      setBootError(null);
      const stored = localStorage.getItem(sessionStorageKey(workflowId));
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { sessionId: string };
          if (parsed.sessionId) {
            setSessionId(parsed.sessionId);
            return;
          }
        } catch {
          localStorage.removeItem(sessionStorageKey(workflowId));
        }
      }

      const session = await api.createChatSession({
        title: workflowName || t(labels, 'editor.chat.sessionTitle'),
        mode: 'chat',
      });
      setSessionId(session.id);
      localStorage.setItem(
        sessionStorageKey(workflowId),
        JSON.stringify({ sessionId: session.id }),
      );
    };

    void boot().catch((e) => {
      setBootError(e instanceof Error ? e.message : String(e));
    });
  }, [workflowId, workflowName, labels]);

  return (
    <aside className="editor-chat-sidebar" style={{ width: widthPx }}>
      <header className="editor-chat-sidebar-header">
        <h3 title={workflowName}>{t(labels, 'editor.chat.title')}</h3>
        <ModalCloseButton onClick={onClose} label={t(labels, 'editor.chat.close')} />
      </header>
      {bootError && <p className="form-error editor-chat-sidebar-error">{bootError}</p>}
      <ChatMessageList
        messages={messages}
        streamingText={streamingText}
        loading={loading}
        labels={labels}
        sessionId={sessionId}
        onFeedback={reloadMessages}
        onRegenerate={(id) => void regenerate(id)}
      />
      <ChatComposer
        disabled={!sessionId || Boolean(bootError)}
        isStreaming={isStreaming}
        onSend={(content) => void send(content)}
        onStop={stop}
        labels={labels}
      />
    </aside>
  );
}
