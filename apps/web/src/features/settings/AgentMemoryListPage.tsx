import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { EmptyState } from '../../components/EmptyState.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import {
  DEFAULT_PAGE_SIZE,
  Pagination,
  type PageSize,
} from '../../components/Pagination.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { t, useLabels } from '../../i18n/labels.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

type SessionRow = {
  sessionId: string;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function AgentMemoryListPage() {
  const labels = useLabels();
  const [items, setItems] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.agentMemory.listSessions({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [labels, page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const removeSession = async (session: SessionRow) => {
    const ok = await confirm({
      title: t(labels, 'common.delete'),
      message: t(labels, 'agentMemory.deleteSessionConfirm', {
        sessionId: session.sessionId,
        count: String(session.messageCount),
      }),
      requireTextMatch: session.sessionId,
      danger: true,
      confirmLabel: t(labels, 'common.delete'),
    });
    if (!ok) return;
    try {
      await api.agentMemory.deleteSession(session.sessionId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SettingsPageShell titleKey="settings.nav.agentMemory">
      {dialog}
      {error ? <p className="error">{error}</p> : null}

      <SettingsSection>
        <form
          className="agent-memory-search-row"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
          }}
        >
          <input
            type="search"
            className="rxwf-input"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t(labels, 'agentMemory.list.searchPlaceholder')}
          />
          <button type="submit" className="btn-secondary">
            {t(labels, 'common.search')}
          </button>
          {search ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearchDraft('');
                setSearch('');
              }}
            >
              {t(labels, 'common.clear')}
            </button>
          ) : null}
        </form>

        {loading && items.length === 0 ? (
          <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
        ) : !loading && items.length === 0 ? (
          <EmptyState title={t(labels, 'agentMemory.list.empty')} />
        ) : (
          <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
            <table className="data-table data-table--header-line-only">
              <thead>
                <tr>
                  <th>{t(labels, 'agentMemory.list.sessionId')}</th>
                  <th>{t(labels, 'agentMemory.list.messageCount')}</th>
                  <th>{t(labels, 'agentMemory.list.firstMessageAt')}</th>
                  <th>{t(labels, 'agentMemory.list.lastMessageAt')}</th>
                  <th>{t(labels, 'common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((session) => (
                  <tr key={session.sessionId}>
                    <td>
                      <code className="agent-memory-session-id">{session.sessionId}</code>
                    </td>
                    <td>{session.messageCount}</td>
                    <td>{formatDateTime(session.firstMessageAt)}</td>
                    <td>{formatDateTime(session.lastMessageAt)}</td>
                    <td className="agent-memory-actions-cell">
                      <Link
                        to={`/settings/agent-memory/${encodeURIComponent(session.sessionId)}`}
                        className="btn-primary btn-secondary--compact"
                      >
                        {t(labels, 'common.view')}
                      </Link>
                      <button
                        type="button"
                        className="btn-danger btn-secondary--compact"
                        onClick={() => void removeSession(session)}
                      >
                        {t(labels, 'common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </LoadingHost>
        )}
      </SettingsSection>
    </SettingsPageShell>
  );
}
