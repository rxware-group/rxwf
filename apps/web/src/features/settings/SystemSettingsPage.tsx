import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

export function SystemSettingsPage() {
  const labels = useLabels();

  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.settings
      .getSystem()
      .then((snap) => {
        if (cancelled) return;
        setPasswordResetEnabled(snap.passwordResetEnabled);
        setSmtpConfigured(Boolean(snap.smtpConfigured));
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

  const testEmail = async () => {
    setMessage(null);
    setError(null);
    setTestingEmail(true);
    try {
      await api.settings.testEmail();
      setMessage(t(labels, 'auto.t_a036158d'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <SettingsPageShell>
        <LoadingHost
          loading
          minHeight="12rem"
          label={t(labels, 'settings.system.loading')}
        />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      lead={<p className="hint settings-page-lead">{t(labels, 'settings.system.lead')}</p>}
    >
      <SettingsSection title={t(labels, 'settings.system.platformEnv')}>
        <p className="hint">
          {t(labels, 'settings.system.platformEnvHint')}{' '}
          <Link to="/settings/env">{t(labels, 'settings.nav.env')}</Link>
        </p>
      </SettingsSection>

      <LoadingHost loading={testingEmail} label={t(labels, 'auto.t_c1b89448')}>
        <SettingsSection title={t(labels, 'settings.system.mail')}>
          {!passwordResetEnabled && (
            <p className="hint">{t(labels, 'settings.system.smtpHint')}</p>
          )}
          {passwordResetEnabled && (
            <p className="success">{t(labels, 'settings.system.passwordResetReady')}</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={testingEmail || !smtpConfigured}
            onClick={() => void testEmail()}
          >
            {t(labels, 'auto.t_1eace6fb')}
          </button>
        </SettingsSection>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </LoadingHost>
    </SettingsPageShell>
  );
}
