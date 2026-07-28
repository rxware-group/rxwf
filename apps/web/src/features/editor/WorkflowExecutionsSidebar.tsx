import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';

function durationMs(startedAt?: string, finishedAt?: string): string {
  if (!startedAt || !finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function versionLabel(workflowVersionId?: string): string {
  if (!workflowVersionId) return '—';
  return workflowVersionId.slice(0, 8);
}

function modeLabel(labels: ReturnType<typeof useLabels>, mode?: string): string {
  if (mode === 'partial') return t(labels, 'executions.mode.debug');
  if (mode === 'manual') return t(labels, 'executions.mode.manual');
  if (mode === 'production') return t(labels, 'executions.mode.production');
  return mode ?? '—';
}

const EXECUTIONS_POLL_MS = 3000;

export function WorkflowExecutionsSidebar({
  workflowId,
  selectedExecutionId,
  basePath,
  refreshKey = 0,
  poll = true,
}: {
  workflowId: string;
  selectedExecutionId: string | null;
  basePath: string;
  refreshKey?: number;
  /** Poll for new executions (e.g. production webhook). */
  poll?: boolean;
}) {
  const labels = useLabels();
  const [items, setItems] = useState<
    Array<{
      id: string;
      status: string;
      mode?: string;
      workflowVersionId?: string;
      startedAt?: string;
      finishedAt?: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = (initial: boolean) => {
      if (initial) {
        setLoading(true);
        setError(null);
      }
      void api.executions
        .list(workflowId)
        .then((res) => {
          if (cancelled) return;
          setItems(res.items);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
        })
        .finally(() => {
          if (!cancelled && initial) setLoading(false);
        });
    };

    load(true);
    if (!poll) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => load(false), EXECUTIONS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workflowId, labels, refreshKey, poll]);

  return (
    <div className="executions-sidebar">
      <div className="executions-sidebar-header">
        <h3>{t(labels, 'editor.tab.executions')}</h3>
      </div>
      <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
      {error && <p className="error executions-sidebar-hint">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="hint executions-sidebar-hint">{t(labels, 'auto.t_6da92c16')}</p>
      )}
      <ul className="executions-sidebar-list">
        {items.map((row) => (
          <li key={row.id}>
            <NavLink
              to={`${basePath}/executions/${row.id}`}
              className={({ isActive }) =>
                `executions-sidebar-item${isActive || selectedExecutionId === row.id ? ' is-active' : ''}`
              }
            >
              <span className={`status-pill status-${row.status}`}>{row.status}</span>
              <span className="executions-sidebar-item-time">
                {row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}
              </span>
              <span className="executions-sidebar-item-meta">
                {durationMs(row.startedAt, row.finishedAt)} · {modeLabel(labels, row.mode)} · v
                {versionLabel(row.workflowVersionId)}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
      </LoadingHost>
    </div>
  );
}
