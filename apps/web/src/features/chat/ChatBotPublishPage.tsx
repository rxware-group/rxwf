import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, type ChatBotSummary } from '../../api/client.js';
import type { AppOutletContext } from '../../layout/app-outlet-context.js';
import { t } from './chat-labels.js';

type ChannelRow = { channel: string; enabled: boolean };

export function ChatBotPublishPage() {
  const { labels } = useOutletContext<AppOutletContext>();
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<ChatBotSummary | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; createdAt: string }>>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState<
    Array<{ id: string; action: string; createdAt: string; detail: Record<string, unknown> }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const publicUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!botId) return;
    void reload();
  }, [botId]);

  async function reload() {
    if (!botId) return;
    const detail = await api.chatBots.get(botId);
    setBot(detail.bot);
    const ch = await api.chatBots.listChannels(botId);
    setChannels(ch.map((c) => ({ channel: c.channel, enabled: c.enabled })));
    setApiKeys(await api.chatBots.listApiKeys(botId));
    setPublishLog(await api.chatBots.publishLog(botId));
  }

  async function publish() {
    if (!botId) return;
    setError(null);
    const b = await api.chatBots.publish(botId);
    setBot(b);
  }

  async function unpublish() {
    if (!botId) return;
    const b = await api.chatBots.unpublish(botId);
    setBot(b);
  }

  async function toggleChannel(channel: string, enabled: boolean) {
    if (!botId) return;
    await api.chatBots.setChannel(botId, channel, enabled);
    await reload();
  }

  async function createKey() {
    if (!botId) return;
    const created = await api.chatBots.createApiKey(botId, 'Default');
    setNewKey(created.key);
    await reload();
  }

  const embedUrl = bot ? `${publicUrl}/embed/${bot.slug}` : '';
  const embedSnippet = bot
    ? `<iframe src="${embedUrl}" style="width:100%;height:600px;border:0" title="${bot.name}"></iframe>`
    : '';

  const statusLabel =
    bot?.status === 'published'
      ? t(labels, 'chat.bot.status.published')
      : t(labels, 'chat.bot.status.draft');

  return (
    <main className="main page">
      <p>
        <Link to={`/chat/bots/${botId}`}>{t(labels, 'chat.bot.publish.back')}</Link>
      </p>
      <header className="page-header">
        <h1 className="rxwf-type-page-title">
          {t(labels, 'chat.bot.publish.title')} · {bot?.name}
        </h1>
        <p className="rxwf-type-page-lead">{statusLabel}</p>
      </header>

      {error && <p className="form-error">{error}</p>}

      <section className="card">
        <div className="rxwf-inline-group">
          <button type="button" className="btn-primary" onClick={() => void publish()}>
            {t(labels, 'chat.bot.publish.action')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void unpublish()}>
            {t(labels, 'chat.bot.publish.unpublish')}
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="rxwf-type-block-title">{t(labels, 'chat.bot.publish.channels')}</h3>
        <ul className="list-plain">
          {channels.map((c) => (
            <li key={c.channel} className="rxwf-list-row">
              <label>
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => void toggleChannel(c.channel, e.target.checked)}
                />{' '}
                {c.channel}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="rxwf-type-block-title">{t(labels, 'chat.bot.publish.embed')}</h3>
        <p>
          <a href={embedUrl} target="_blank" rel="noreferrer">
            {embedUrl}
          </a>
        </p>
        <pre className="rxwf-type-code">{embedSnippet}</pre>
      </section>

      <section className="card">
        <h3 className="rxwf-type-block-title">{t(labels, 'chat.bot.publish.history')}</h3>
        {publishLog.length === 0 ? (
          <p className="muted">{t(labels, 'chat.bot.publish.historyEmpty')}</p>
        ) : (
          <ul className="list-plain">
            {publishLog.map((row) => (
              <li key={row.id} className="rxwf-list-row">
                <strong>{row.action}</strong> · {new Date(row.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3 className="rxwf-type-block-title">{t(labels, 'chat.bot.publish.keys')}</h3>
        <button type="button" className="btn-secondary" onClick={() => void createKey()}>
          {t(labels, 'chat.bot.publish.genKey')}
        </button>
        {newKey && (
          <p className="form-error rxwf-mt-inline">
            {t(labels, 'chat.bot.publish.keyOnce')}
            <code>{newKey}</code>
          </p>
        )}
        <ul className="list-plain rxwf-mt-4">
          {apiKeys.map((k) => (
            <li key={k.id} className="rxwf-list-row">
              {k.name} · {k.id.slice(0, 8)}
              <button
                type="button"
                className="btn-danger rxwf-ml-inline"
                onClick={() => botId && void api.chatBots.deleteApiKey(botId, k.id).then(reload)}
              >
                {t(labels, 'chat.bot.publish.delete')}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted rxwf-mt-4">
          API：<code>POST /api/public/chat/bots/{bot?.slug}/chat</code> · Header{' '}
          <code>Authorization: Bearer &lt;key&gt;</code>
        </p>
        <p className="muted rxwf-mt-inline">
          MCP：<code>chat_bot_run</code> · args{' '}
          <code>{`{ botSlug: "${bot?.slug ?? ''}", message: "..." }`}</code>
        </p>
      </section>
    </main>
  );
}
