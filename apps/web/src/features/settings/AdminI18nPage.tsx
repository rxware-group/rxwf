import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { SettingsPageShell } from './SettingsPageShell.js';

export function AdminI18nPage() {
  const labels = useLabels();

  const [locale, setLocale] = useState('zh-CN');
  const [json, setJson] = useState('{\n  "nav.workflows": "Workflows"\n}');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setMessage(null);
    setError(null);
    try {
      const messages = JSON.parse(json) as Record<string, string>;
      await api.admin.putI18n(locale, messages);
      setMessage(t(labels, 'toast.i18nUpdated', { locale }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SettingsPageShell
      lead={<p className="hint settings-page-lead">{t(labels, 'settings.adminI18n.lead')}</p>}
    >
      <section className="panel settings-panel">
        <FormField label="Locale">
          <input value={locale} onChange={(e) => setLocale(e.target.value)} />
        </FormField>
        <FormField label="Messages JSON">
          <textarea rows={10} value={json} onChange={(e) => setJson(e.target.value)} />
        </FormField>
        <button type="button" className="btn-primary" onClick={() => void save()}>
          {t(labels, 'auto.t_fadf24db')}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </SettingsPageShell>
  );
}
