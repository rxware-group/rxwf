import { t, useLabels } from '../../i18n/labels.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { AuthBranding } from './AuthBranding.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';

export function ForgotPasswordPage() {
  const labels = useLabels();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(email.trim());
      setSuccessMessage(res.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(labels, 'auto.t_8fdc4112'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <AuthBranding />
        <h1>{t(labels, 'auth.forgotPasswordTitle')}</h1>
        {sent ? (
          <>
            <p className="hint">{successMessage}</p>
            <Link to="/login" className="auth-forgot-link">
              {t(labels, 'auth.backToLogin')}
            </Link>
          </>
        ) : (
          <LoadingHost loading={loading} label={t(labels, 'auto.t_c1b89448')}>
          <>
            <p className="hint">{t(labels, 'auth.forgotPasswordHint')}</p>
            <FormField label={t(labels, 'common.email')}>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>
            {error && <p className="error">{error}</p>}
            <div className="auth-actions">
              <button type="submit" disabled={loading}>
                {t(labels, 'auto.t_9c68e05f')}
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
