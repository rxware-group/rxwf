import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, type RunnerSummary } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';
import type { SettingsOutletContext } from '../settings/settings-context.js';

function statusLabel(labels: LabelMap, status: string): string {
  if (status === 'online') return t(labels, 'runners.status.online');
  if (status === 'draining') return t(labels, 'runners.status.draining');
  return t(labels, 'runners.status.offline');
}

function kindLabel(labels: LabelMap, kind: string): string {
  return kind === 'embedded' ? t(labels, 'auto.t_09ceea76') : 'Agent';
}

function formatRelativeTime(iso: string | null, labels: LabelMap): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const deltaSec = Math.round((Date.now() - then) / 1000);
  if (deltaSec < 60) return t(labels, 'runners.heartbeat.justNow');
  if (deltaSec < 3600) {
    const min = Math.floor(deltaSec / 60);
    return t(labels, 'runners.heartbeat.minutesAgo', { count: String(min) });
  }
  if (deltaSec < 86_400) {
    const hr = Math.floor(deltaSec / 3600);
    return t(labels, 'runners.heartbeat.hoursAgo', { count: String(hr) });
  }
  const days = Math.floor(deltaSec / 86_400);
  return t(labels, 'runners.heartbeat.daysAgo', { count: String(days) });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function RunnerListPage() {
  const labels = useLabels();
  const { user, features } = useOutletContext<SettingsOutletContext>();
  const isAdmin = user.role === 'admin';
  const serverUrl = features?.publicUrl ?? window.location.origin;

  const [runners, setRunners] = useState<RunnerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.runners.list();
      setRunners(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
      setRunners([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateToken = async () => {
    setTokenBusy(true);
    setTokenError(null);
    setCopyHint(null);
    try {
      const result = await api.runners.createRegistrationToken();
      setRegistrationToken(result.registrationToken);
      setTokenExpiresAt(result.expiresAt);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
    } finally {
      setTokenBusy(false);
    }
  };

  const registerCommand = registrationToken
    ? `rxwf-runner register --config rxwf-runner.json --token ${registrationToken}`
    : '';
  const startCommand = 'rxwf-runner start --config rxwf-runner.json';

  return (
    <SettingsPageShell>
      {isAdmin && (
        <SettingsSection title={t(labels, 'runners.registerAgent')}>
          <p className="hint">{t(labels, 'runners.registerAgentHint', { serverUrl })}</p>
          <header className="settings-page-toolbar">
            <button type="button" onClick={() => void handleCreateToken()} disabled={tokenBusy}>
              {tokenBusy
                ? t(labels, 'common.loading')
                : t(labels, 'runners.createRegistrationToken')}
            </button>
          </header>
          {tokenError && <p className="error">{tokenError}</p>}
          {registrationToken && (
            <div className="runner-register-panel">
              <FormRow
                label={t(labels, 'runners.registrationToken')}
                value={registrationToken}
                copyLabel={t(labels, 'runners.copy')}
                onCopy={async () => {
                  const ok = await copyText(registrationToken);
                  setCopyHint(
                    ok ? t(labels, 'runners.copied') : t(labels, 'runners.copyFailed'),
                  );
                }}
              />
              {tokenExpiresAt && (
                <p className="hint">
                  {t(labels, 'runners.tokenExpiresAt')}: {new Date(tokenExpiresAt).toLocaleString()}
                </p>
              )}
              <FormRow
                label={t(labels, 'runners.cmdRegister')}
                value={registerCommand}
                copyLabel={t(labels, 'runners.copy')}
                onCopy={async () => {
                  const ok = await copyText(registerCommand);
                  setCopyHint(
                    ok ? t(labels, 'runners.copied') : t(labels, 'runners.copyFailed'),
                  );
                }}
              />
              <FormRow
                label={t(labels, 'runners.cmdStart')}
                value={startCommand}
                copyLabel={t(labels, 'runners.copy')}
                onCopy={async () => {
                  const ok = await copyText(startCommand);
                  setCopyHint(
                    ok ? t(labels, 'runners.copied') : t(labels, 'runners.copyFailed'),
                  );
                }}
              />
              {copyHint && <p className="hint">{copyHint}</p>}
            </div>
          )}
        </SettingsSection>
      )}

      <SettingsSection title={t(labels, 'common.registered')}>
        <header className="settings-page-toolbar">
          <button type="button" onClick={() => void load()} disabled={loading}>
            {t(labels, 'auto.t_38108eaa')}
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        <LoadingHost loading={loading} label={t(labels, 'common.loading')}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t(labels, 'auto.t_1be7ae4f')}</th>
                <th>{t(labels, 'runners.col.platform')}</th>
                <th>{t(labels, 'auto.t_62e951a6')}</th>
                <th>{t(labels, 'runners.col.load')}</th>
                <th>{t(labels, 'auto.t_e4e46c72')}</th>
                <th>{t(labels, 'runners.col.labels')}</th>
                <th>{t(labels, 'runners.col.capabilities')}</th>
                <th>{t(labels, 'runners.col.agentVersion')}</th>
                <th>{t(labels, 'runners.col.crewaiSidecar')}</th>
                <th>{t(labels, 'runners.col.lastHeartbeat')}</th>
              </tr>
            </thead>
            <tbody>
              {runners.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td title={r.platform.os}>
                    {r.platform.os} / {r.platform.arch}
                  </td>
                  <td>{statusLabel(labels, r.status)}</td>
                  <td
                    className={
                      r.runningJobs >= r.maxConcurrent && r.maxConcurrent > 0
                        ? 'warn'
                        : undefined
                    }
                  >
                    {r.status === 'offline' ? '—' : `${r.runningJobs}/${r.maxConcurrent}`}
                  </td>
                  <td>{kindLabel(labels, r.kind)}</td>
                  <td>{r.labels.length ? r.labels.join(', ') : '—'}</td>
                  <td>{r.capabilities?.length ? r.capabilities.join(', ') : '—'}</td>
                  <td>{r.agentVersion ?? '—'}</td>
                  <td className="mono" title={r.crewaiSidecarUrl ?? undefined}>
                    {r.crewaiSidecarUrl ?? '—'}
                  </td>
                  <td title={r.lastHeartbeatAt ?? undefined}>
                    {formatRelativeTime(r.lastHeartbeatAt, labels)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !error && runners.length === 0 && (
            <p>{t(labels, 'runners.empty')}</p>
          )}
        </LoadingHost>
      </SettingsSection>
    </SettingsPageShell>
  );
}

function FormRow({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void | Promise<void>;
}) {
  return (
    <div className="runner-cmd-row">
      <label>{label}</label>
      <div className="runner-cmd-row__body">
        <code>{value}</code>
        <button type="button" className="btn-sm" onClick={() => void onCopy()}>
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
