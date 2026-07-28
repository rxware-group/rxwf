import { useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { SettingsPageShell } from './SettingsPageShell.js';

export function AdminThemePage() {
  const labels = useLabels();

  const [themeId, setThemeId] = useState('dark');
  const [json, setJson] = useState(
    '{\n  "--color-bg": "#0f172a",\n  "--color-text": "#f8fafc"\n}',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setMessage(null);
    setError(null);
    try {
      const tokens = JSON.parse(json) as Record<string, string>;
      await api.admin.putTheme(themeId, tokens);
      setMessage(t(labels, 'toast.themeUpdated', { themeId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SettingsPageShell>
      <section className="panel settings-panel">
        <FormField label="Theme ID">
          <input value={themeId} onChange={(e) => setThemeId(e.target.value)} />
        </FormField>
        <FormField label="Tokens JSON">
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
