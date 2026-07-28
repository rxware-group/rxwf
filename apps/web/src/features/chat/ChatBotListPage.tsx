import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, AwfClientError, type ChatBotSummary } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { MoreMenu } from '../../components/MoreMenu.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { t, useAppLabels } from '../../i18n/labels.js';

import { normalizeLocale } from '../../i18n/locales.js';

function chatBotListFallback(key: 'creating' | 'nameRequired' | 'deleteConfirm'): string {
  const en = normalizeLocale(localStorage.getItem('rxwf.locale')) === 'en-US';
  if (key === 'creating') return en ? 'Creating…' : '创建中…';
  if (key === 'deleteConfirm') {
    return en
      ? 'Delete bot "{name}"? This cannot be undone.'
      : '删除 Bot「{name}」？此操作不可撤销。';
  }
  return en ? 'Enter a bot name' : '请输入 Bot 名称';
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function botStatusLabel(labels: Record<string, string>, status: ChatBotSummary['status']): string {
  return status === 'published'
    ? t(labels, 'chat.bot.status.published')
    : t(labels, 'chat.bot.status.draft');
}

function botMetaLine(labels: Record<string, string>, bot: ChatBotSummary): string {
  const createdLabel = t(labels, 'workflows.meta.createdAt', undefined, '创建时间');
  const updatedLabel = t(labels, 'workflows.meta.updatedAt', undefined, '最后修改时间');
  return `${createdLabel} ${formatDateTime(bot.createdAt)} · ${updatedLabel} ${formatDateTime(bot.updatedAt)}`;
}

export function ChatBotListPage() {
  const labels = useAppLabels();
  const navigate = useNavigate();
  const [bots, setBots] = useState<ChatBotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { confirm, dialog } = useConfirm();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.chatBots.list();
      setBots(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError(t(labels, 'chat.bot.list.nameRequired', undefined, chatBotListFallback('nameRequired')));
      return;
    }
    setCreating(true);
    try {
      const bot = await api.chatBots.create({ name: name.trim() });
      setName('');
      reload();
      navigate(`/chat/bots/${bot.id}`);
    } catch (e) {
      if (e instanceof AwfClientError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setCreating(false);
    }
  }

  async function remove(bot: ChatBotSummary) {
    const ok = await confirm({
      title: t(labels, 'common.delete'),
      message: t(
        labels,
        'chat.bot.list.deleteConfirm',
        { name: bot.name },
        chatBotListFallback('deleteConfirm'),
      ),
      requireTextMatch: bot.name,
      danger: true,
      confirmLabel: t(labels, 'common.delete'),
    });
    if (!ok) return;
    try {
      await api.chatBots.remove(bot.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleMoreAction(bot: ChatBotSummary, key: string) {
    if (key === 'edit') navigate(`/chat/bots/${bot.id}`);
    if (key === 'publish') navigate(`/chat/bots/${bot.id}/publish`);
    if (key === 'delete') void remove(bot);
  }

  return (
    <main className="main page workflow-list-page">
      {dialog}
      <header className="page-header">
        <h1 className="rxwf-type-page-title">{t(labels, 'chat.bot.list.title')}</h1>
        <p className="rxwf-type-page-lead">{t(labels, 'chat.bot.list.desc')}</p>
      </header>

      <div className="workflow-list-toolbar">
        <Link to="/chat" className="btn-secondary">
          {t(labels, 'chat.bot.list.back')}
        </Link>
        <div className="row workflow-list-actions">
          <LoadingHost
            loading={creating}
            label={t(labels, 'chat.bot.list.creating', undefined, chatBotListFallback('creating'))}
          >
            <div className="rxwf-inline-group">
              <input
                type="text"
                placeholder={t(labels, 'chat.bot.list.placeholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                }}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={creating}
                onClick={() => void create()}
              >
                {t(labels, 'chat.bot.list.create')}
              </button>
            </div>
          </LoadingHost>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
      ) : bots.length === 0 && !error ? (
        <EmptyState
          icon="chat"
          title={t(labels, 'chat.bot.list.emptyTitle')}
          description={t(labels, 'chat.bot.list.emptyDesc')}
        />
      ) : bots.length > 0 ? (
        <section className="workflow-list-section">
          <ul className="workflow-list">
            {bots.map((b) => (
              <li key={b.id} className="workflow-list-item">
                <div className="workflow-list-item-main">
                  <div className="workflow-list-item-head">
                    <Link to={`/chat/bots/${b.id}`} className="workflow-list-item-title">
                      {b.name}
                    </Link>
                    <span className={`status-pill status-${b.status}`}>
                      {botStatusLabel(labels, b.status)}
                    </span>
                    <span className="hint">/{b.slug}</span>
                  </div>
                  <p className="hint workflow-list-item-meta">{botMetaLine(labels, b)}</p>
                </div>
                <div className="workflow-list-item-actions">
                  <MoreMenu
                    ariaLabel={t(labels, 'auto.t_b196954f')}
                    items={[
                      { key: 'edit', label: t(labels, 'chat.bot.editor.title') },
                      { key: 'publish', label: t(labels, 'chat.bot.publish.title') },
                      { key: 'delete', label: t(labels, 'common.delete'), danger: true },
                    ]}
                    onAction={(key) => handleMoreAction(b, key)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
