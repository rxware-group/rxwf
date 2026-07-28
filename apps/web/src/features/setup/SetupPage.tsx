import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { SettingsPageShell } from '../settings/SettingsPageShell.js';

const CHECKLIST_KEYS: Record<string, string> = {
  database: 'auto.t_949ec1f3',
  admin: 'auto.t_f056b421',
  embedded_runner: 'auto.Runner_052d611d',
  public_url: 'auto.URL_RXWF_PUBLIC_URL_e1aaf488',
};

export function SetupPage() {
  const labels = useLabels();

  const [checklist, setChecklist] = useState<{
    complete: boolean;
    items: Array<{ id: string; label: string; done: boolean }>;
  } | null>(null);

  useEffect(() => {
    void api.setupChecklist().then(setChecklist);
  }, []);

  return (
    <SettingsPageShell>
      <LoadingHost
        loading={!checklist}
        minHeight="12rem"
        label={t(labels, 'setup.loadingChecklist')}
      >
      {checklist && (
      <section className="panel settings-panel">
        <ul>
          {checklist.items.map((item) => (
            <li key={item.id}>
              {item.done ? '✓' : '○'}{' '}
              {CHECKLIST_KEYS[item.id] ? t(labels, CHECKLIST_KEYS[item.id]!) : item.label}
            </li>
          ))}
        </ul>
        {!checklist.items.find((i) => i.id === 'public_url')?.done && (
          <p className="hint">{t(labels, 'setup.publicUrlHint')}</p>
        )}
        <p>
          <Link to="/templates">{t(labels, 'setup.browseTemplates')}</Link> ·{' '}
          <Link to="/">{t(labels, 'setup.backToWorkflows')}</Link>
        </p>
      </section>
      )}
      </LoadingHost>
    </SettingsPageShell>
  );
}

