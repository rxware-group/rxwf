import { useEffect, useMemo, useState } from 'react';
import { api, type WebSearchSettingsSnapshot } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';
import { t, useLabels } from '../../i18n/labels.js';
import { SettingsPageShell } from './SettingsPageShell.js';

const PROVIDERS = [
  { value: 'tavily', label: 'Tavily' },
  { value: 'brave', label: 'Brave' },
  { value: 'bing', label: 'Bing' },
  { value: 'custom', label: 'Custom' },
] as const;

export function WebSearchSettings() {
  const labels = useLabels();
  const [form, setForm] = useState<WebSearchSettingsSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Array<{ id: string; name: string; type: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.settings.getWebSearch(), api.credentials.list()])
      .then(([settings, creds]) => {
        if (cancelled) return;
        setForm(settings);
        setCredentials(creds);
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

  const apiKeyCredentials = useMemo(
    () => credentials.filter((c) => c.type === 'apiKey'),
    [credentials],
  );

  const update = <K extends keyof WebSearchSettingsSnapshot>(
    key: K,
    value: WebSearchSettingsSnapshot[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!form) return;
    setMessage(null);
    setError(null);
    try {
      await api.settings.updateWebSearch(form);
      setForm(await api.settings.getWebSearch());
      setMessage(t(labels, 'auto.t_fadf24db'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const testConnection = async () => {
    if (!form) return;
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.settings.testWebSearch(form);
      setMessage(
        `${t(labels, 'settings.webSearch.testOk')} (${result.latencyMs}ms): ${result.preview.slice(0, 120)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  if (loading || !form) {
    return (
      <SettingsPageShell>
        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      lead={
        <p className="hint settings-page-lead">
          {t(labels, 'settings.webSearch.lead')}
        </p>
      }
    >
      <section className="panel settings-panel">
        <FormField label={t(labels, 'settings.webSearch.enabled')}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            {t(labels, 'settings.webSearch.enabledHint')}
          </label>
        </FormField>

        <FormField label={t(labels, 'settings.webSearch.provider')}>
          <Select
            value={form.defaultProvider}
            onChange={(value) =>
              update('defaultProvider', value as WebSearchSettingsSnapshot['defaultProvider'])
            }
            options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </FormField>

        <FormField label={t(labels, 'settings.webSearch.credential')}>
          <Select
            value={form.defaultCredentialId ?? ''}
            onChange={(value) => update('defaultCredentialId', value || undefined)}
            options={[
              { value: '', label: t(labels, 'settings.webSearch.credentialPlaceholder') },
              ...apiKeyCredentials.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FormField>

        {form.defaultProvider === 'custom' && (
          <FormField label={t(labels, 'settings.webSearch.customBaseUrl')}>
            <input
              value={form.customBaseUrl ?? ''}
              onChange={(e) => update('customBaseUrl', e.target.value)}
              placeholder="https://search-gateway.example.com"
              className="mono"
            />
          </FormField>
        )}

        <FormField label={t(labels, 'settings.webSearch.maxResults')}>
          <input
            type="number"
            min={1}
            value={form.maxResults}
            onChange={(e) => update('maxResults', Number(e.target.value) || 10)}
          />
        </FormField>

        <FormField label={t(labels, 'settings.webSearch.timeoutMs')}>
          <input
            type="number"
            min={1000}
            step={1000}
            value={form.timeoutMs}
            onChange={(e) => update('timeoutMs', Number(e.target.value) || 30_000)}
          />
        </FormField>

        <FormField label={t(labels, 'settings.webSearch.maxQueries')}>
          <input
            type="number"
            min={1}
            value={form.maxQueriesPerExecution}
            onChange={(e) =>
              update('maxQueriesPerExecution', Number(e.target.value) || 10)
            }
          />
        </FormField>

        <div className="rxwf-actions-row">
          <button type="button" className="btn-primary" onClick={() => void save()}>
            {t(labels, 'auto.t_fadf24db')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={testing || !form.enabled}
            onClick={() => void testConnection()}
          >
            {testing
              ? t(labels, 'common.loading')
              : t(labels, 'settings.webSearch.testConnection')}
          </button>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </SettingsPageShell>
  );
}
