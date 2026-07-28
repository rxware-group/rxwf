import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { AuthBranding } from './AuthBranding.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';

export function ResetPasswordPage() {
  const labels = useLabels();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t(labels, 'auto.t_29c495db'));
      return;
    }
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
      await api.auth.resetPassword(token, password);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t(labels, 'auto.t_dd9a02ea'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <AuthBranding />
        <h1>{t(labels, 'auto.t_7e422146')}</h1>
        {!token ? (
          <>
            <p className="error">{t(labels, 'auto.t_29c495db')}</p>
            <Link to="/login" className="auth-forgot-link">
              {t(labels, 'auth.backToLogin')}
            </Link>
          </>
        ) : (
          <LoadingHost loading={loading} label={t(labels, 'common.saving')}>
          <>
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
              <Link to="/login" className="auth-forgot-link">
                {t(labels, 'auth.backToLogin')}
              </Link>
            </div>
          </>
          </LoadingHost>
        )}
      </form>
    </div>
  );
}
