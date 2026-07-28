import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';

interface InitialSetupPageProps {
  onComplete: () => void;
}

export function InitialSetupPage({
 onComplete }: InitialSetupPageProps) {
  const labels = useLabels();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t(labels, 'auto.t_3e2b222d'));
      return;
    }
    if (password.length < 8) {
      setError(t(labels, 'auto.8_67ac9405'));
      return;
    }
    setLoading(true);
    try {
      await api.auth.setup(email.trim(), password);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(labels, 'auto.t_deb39901'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <LoadingHost loading={loading} label={t(labels, 'auto.t_1680b04b')}>
        <h1>{t(labels, 'auth.welcome')}</h1>
        <p className="hint">{t(labels, 'auth.setupHint')}</p>
        <FormField label={t(labels, 'common.email')}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label={t(labels, 'common.password')}>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </FormField>
        <FormField label={t(labels, 'auto.t_1d0167f6')}>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </FormField>
        {error && <p className="error">{error}</p>}
        <div className="auth-actions">
          <button type="submit" disabled={loading}>
            {t(labels, 'auto.t_9e9d602f')}
          </button>
        </div>
        </LoadingHost>
      </form>
    </div>
  );
}
