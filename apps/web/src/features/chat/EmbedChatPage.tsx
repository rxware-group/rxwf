import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicChat, type ChatMessage, type ChatStreamEvent } from '../../api/client.js';
import { ChatComposer } from './components/ChatComposer.js';
import { ChatMessageList } from './components/ChatMessageList.js';
import { useEmbedLabels } from './use-embed-labels.js';

function storageKey(slug: string) {
  return `rxwf-embed:${slug}`;
}

export function EmbedChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const labels = useEmbedLabels();
  const [botName, setBotName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#cc5de8');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingPhase, setStreamingPhase] = useState<import('../../api/client.js').ChatProcessingPhase | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (sid: string, token: string) => {
    const { messages: list } = await publicChat.listMessages(sid, token);
    setMessages(list);
  }, []);

  const boot = useCallback(async () => {
    if (!slug) return;
    const stored = localStorage.getItem(storageKey(slug));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          sessionId: string;
          clientToken: string;
          botName?: string;
        };
        setSessionId(parsed.sessionId);
        setClientToken(parsed.clientToken);
        if (parsed.botName) setBotName(parsed.botName);
        await loadMessages(parsed.sessionId, parsed.clientToken);
        return;
      } catch {
        localStorage.removeItem(storageKey(slug));
      }
    }

    const created = await publicChat.createSession(slug);
    setSessionId(created.sessionId);
    setClientToken(created.clientToken);
    setBotName(created.bot.name);
    setThemeColor(created.bot.themeColor);
    localStorage.setItem(
      storageKey(slug),
      JSON.stringify({
        sessionId: created.sessionId,
        clientToken: created.clientToken,
        botName: created.bot.name,
      }),
    );
    if (created.bot.themeColor) {
      document.documentElement.style.setProperty('--embed-theme', created.bot.themeColor);
    }
    await loadMessages(created.sessionId, created.clientToken);
  }, [slug, loadMessages]);

  useEffect(() => {
    void boot().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [boot]);

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty('--embed-theme', themeColor);
    }
  }, [themeColor]);

  async function send(content: string) {
    if (!sessionId || !clientToken) return;
    setError(null);
    setStreamingText('');
    setStreamingPhase(null);
    setIsStreaming(true);
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sessionId, role: 'user', content, createdAt: now },
    ]);

    try {
      await publicChat.stream(sessionId, clientToken, content, {
        onEvent: (ev: ChatStreamEvent) => {
          if (ev.type === 'status') setStreamingPhase(ev.phase);
          if (ev.type === 'token') {
            setStreamingPhase(null);
            setStreamingText((text) => (text ?? '') + ev.token);
          }
        },
      });
      await loadMessages(sessionId, clientToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreamingText(null);
      setStreamingPhase(null);
      setIsStreaming(false);
    }
  }

  return (
    <div className="embed-chat" style={{ ['--chat-accent' as string]: themeColor }}>
      <header className="embed-chat-header">
        <h1>{botName || slug}</h1>
      </header>
      {error && <p className="form-error">{error}</p>}
      <ChatMessageList
        messages={messages}
        streamingText={streamingText}
        streamingPhase={streamingPhase}
        labels={labels}
      />
      <ChatComposer
        disabled={!sessionId}
        isStreaming={isStreaming}
        onSend={(c) => void send(c)}
        onStop={() => setIsStreaming(false)}
        labels={labels}
      />
    </div>
  );
}
