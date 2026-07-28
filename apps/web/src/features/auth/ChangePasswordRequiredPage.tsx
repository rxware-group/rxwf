import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { AuthBranding } from './AuthBranding.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';

interface ChangePasswordRequiredPageProps {
  onComplete: () => void | Promise<void>;
}

export function ChangePasswordRequiredPage({
 onComplete }: ChangePasswordRequiredPageProps) {
  const labels = useLabels();

  const navigate = useNavigate();
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
      await api.auth.changePassword({ newPassword: password });
      await onComplete();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t(labels, 'auto.t_5284818d'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <LoadingHost loading={loading} label={t(labels, 'common.saving')}>
        <AuthBranding />
        <h1>{t(labels, 'settings.profile.changePassword')}</h1>
        <p>{t(labels, 'auth.changePasswordRequired')}</p>
        <FormField label={t(labels, 'auto.t_d22c9c00')}>
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
            {t(labels, 'auto.t_162288b7')}
          </button>
        </div>
        </LoadingHost>
      </form>
    </div>
  );
}
