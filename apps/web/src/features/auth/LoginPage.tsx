import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { safeRedirectPath } from './redirect-to-login.js';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { AuthBranding } from './AuthBranding.js';

interface LoginPageProps {
  onLogin: () => void | Promise<void>;
}

export function LoginPage({
 onLogin }: LoginPageProps) {
  const labels = useLabels();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get('redirect'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEnabled, setResetEnabled] = useState(false);

  useEffect(() => {
    void api.auth
      .passwordResetStatus()
      .then((res) => setResetEnabled(res.enabled))
      .catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.auth.login(email.trim(), password);
      await onLogin();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t(labels, 'auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <LoadingHost loading={loading} label={t(labels, 'auth.loggingIn')}>
        <AuthBranding />
        <h1>{t(labels, 'auth.login')}</h1>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        {error && <p className="error">{error}</p>}
        <div className="auth-actions">
          <button type="submit" disabled={loading}>
            {t(labels, 'auth.login')}
          </button>
          {resetEnabled && (
            <Link to="/forgot-password" className="auth-forgot-link">
              {t(labels, 'auth.forgotPassword')}
            </Link>
          )}
        </div>
        </LoadingHost>
      </form>
    </div>
  );
}
