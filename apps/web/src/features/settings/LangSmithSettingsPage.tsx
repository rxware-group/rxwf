import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { SettingsPageShell } from './SettingsPageShell.js';

const MASK = '***';

function envValue(items: Awaited<ReturnType<typeof api.env.list>>, key: string): string {
  const row = items.find((i) => i.key === key);
  if (!row) return '';
  return row.value === MASK ? MASK : row.value;
}

export function LangSmithSettingsPage() {
  const labels = useLabels();

  const [tracingV2, setTracingV2] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [project, setProject] = useState('rx-workflow');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyFromList = (items: Awaited<ReturnType<typeof api.env.list>>) => {
    setTracingV2(envValue(items, 'RXWF_LANGCHAIN_TRACING_V2') === 'true');
    setApiKey(envValue(items, 'RXWF_LANGCHAIN_API_KEY'));
    setProject(envValue(items, 'RXWF_LANGCHAIN_PROJECT') || 'rx-workflow');
    const tracing = envValue(items, 'RXWF_LANGCHAIN_TRACING_V2') === 'true';
    const key = envValue(items, 'RXWF_LANGCHAIN_API_KEY');
    setEnabled(tracing && Boolean(key && key !== MASK));
  };

  useEffect(() => {
    let cancelled = false;
    void api.env
      .list()
      .then((items) => {
        if (cancelled) return;
        applyFromList(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setMessage(null);
    setError(null);
    try {
      const payload: Array<{ key: string; value: string }> = [
        { key: 'RXWF_LANGCHAIN_TRACING_V2', value: tracingV2 ? 'true' : 'false' },
        { key: 'RXWF_LANGCHAIN_PROJECT', value: project },
      ];
      if (apiKey && apiKey !== MASK) {
        payload.push({ key: 'RXWF_LANGCHAIN_API_KEY', value: apiKey });
      }
      const items = await api.env.update(payload);
      applyFromList(items);
      setMessage(t(labels, 'auto.API_LangSmith_128b239c'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <SettingsPageShell>
        <LoadingHost
          loading
          minHeight="12rem"
          label={t(labels, 'common.loading')}
        />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      lead={
        <p className="hint settings-page-lead">
          {t(labels, 'settings.langsmith.leadPrefix')}{' '}
          <code>metadata.agentSteps</code>
          {t(labels, 'settings.langsmith.leadSuffix')}
        </p>
      }
    >
      <section className="panel settings-panel">
        {enabled && (
          <p className="success">{t(labels, 'settings.langsmith.enabled')}</p>
        )}
        <p className="hint">
          {t(labels, 'settings.langsmith.platformEnvHint')}{' '}
          <Link to="/settings/env">{t(labels, 'settings.nav.env')}</Link>
        </p>
        <FormField label={t(labels, 'auto.t_dacf84a4')}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={tracingV2}
              onChange={(e) => setTracingV2(e.target.checked)}
            />
            RXWF_LANGCHAIN_TRACING_V2
          </label>
        </FormField>
        <FormField label="API Key">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKey === MASK ? t(labels, 'auto.t_92a3b6a5') : 'lsv2_pt_…'}
            className="mono"
            autoComplete="off"
          />
        </FormField>
        <FormField label={t(labels, 'auto.LANGCHAIN_PROJECT_bd960719')}>
          <input value={project} onChange={(e) => setProject(e.target.value)} />
        </FormField>
        <div className="rxwf-actions-row">
          <button type="button" className="btn-primary" onClick={() => void save()}>
            {t(labels, 'auto.t_fadf24db')}
          </button>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </SettingsPageShell>
  );
}
