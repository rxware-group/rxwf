import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { api, type AuthUser, type SystemFeatures } from './api/client.js';
import { AppShell } from './layout/AppShell.js';
import { WorkflowListPage } from './features/workflows/WorkflowListPage.js';
import { WorkflowEditorPage } from './features/editor/WorkflowEditorPage.js';
import { SettingsModalHost } from './features/settings/SettingsModalHost.js';
import { settingsChildRoutes } from './features/settings/settings-app-routes.js';
import { getSettingsBackground } from './features/settings/settings-location-state.js';
import { ChatPage } from './features/chat/ChatPage.js';
import { ChatBotListPage } from './features/chat/ChatBotListPage.js';
import { ChatBotEditorPage } from './features/chat/ChatBotEditorPage.js';
import { ChatBotPublishPage } from './features/chat/ChatBotPublishPage.js';
import { EmbedChatPage } from './features/chat/EmbedChatPage.js';
import { KnowledgeListPage } from './features/knowledge/KnowledgeListPage.js';
import { KnowledgeDetailPage } from './features/knowledge/KnowledgeDetailPage.js';
import { TemplateGalleryPage } from './features/templates/TemplateGalleryPage.js';
import { InitialSetupPage } from './features/auth/InitialSetupPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RedirectToLogin } from './features/auth/redirect-to-login.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage.js';
import { ChangePasswordRequiredPage } from './features/auth/ChangePasswordRequiredPage.js';
import { applyThemeId, readStoredThemeId, normalizeThemeId } from './hooks/use-theme-id.js';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider, t } from './i18n/labels.js';
import { normalizeLocale } from './i18n/locales.js';
import { LoadingHost } from './components/LoadingHost.js';
import { HelpLayout } from './features/help/HelpLayout.js';

type AuthPhase = 'loading' | 'setup' | 'login' | 'app';

function AgentLegacyRedirect() {
  const { workflowId } = useParams();
  if (!workflowId || workflowId.startsWith('new')) {
    return <Navigate to="/templates" replace />;
  }
  return <Navigate to={`/workflows/${workflowId}`} replace />;
}

function readStoredLocale(): string {
  const raw = localStorage.getItem('rxwf.locale');
  const locale = normalizeLocale(raw);
  if (raw !== locale) {
    localStorage.setItem('rxwf.locale', locale);
  }
  return locale;
}

function localeLabels(locale: string): Record<string, string> {
  return getLocaleBundle(locale);
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<AuthPhase>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [features, setFeatures] = useState<SystemFeatures | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    localeLabels(readStoredLocale()),
  );
  const [locale, setLocale] = useState(readStoredLocale);
  const [themeId, setThemeId] = useState(readStoredThemeId);
  const loadLabels = useCallback(async (code: string) => {
    try {
      const messages = await api.i18n(code);
      setLabels({ ...localeLabels(code), ...messages });
    } catch {
      setLabels(localeLabels(code));
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    const status = await api.auth.status();
    if (status.needsSetup) {
      setPhase('setup');
      setUser(null);
      return;
    }
    if (!status.authenticated || !status.user) {
      setPhase('login');
      setUser(null);
      return;
    }
    setUser(status.user);
    setPhase('app');
  }, []);

  useEffect(() => {
    void refreshAuth().catch(() => setPhase('login'));
  }, [refreshAuth]);

  useEffect(() => {
    void loadLabels(readStoredLocale());
  }, [loadLabels]);

  useEffect(() => {
    void applyThemeId(themeId);
  }, [themeId]);

  useEffect(() => {
    if (phase !== 'app') return;
    void api.features().then(setFeatures);
    const storedLocale = readStoredLocale();
    void loadLabels(storedLocale);
    void api.preferences
      .get()
      .then((prefs) => {
        const locale = normalizeLocale(prefs.locale);
        const nextThemeId = normalizeThemeId(prefs.themeId);
        setLocale(locale);
        setThemeId(nextThemeId);
        localStorage.setItem('rxwf.locale', locale);
        localStorage.setItem('rxwf.themeId', nextThemeId);
        if (locale !== prefs.locale) {
          void api.preferences.patch({ locale }).catch(() => undefined);
        }
        return loadLabels(locale);
      })
      .catch(() => loadLabels(storedLocale));
  }, [phase, loadLabels]);

  const handleLocaleChange = async (next: string) => {
    setLocale(next);
    localStorage.setItem('rxwf.locale', next);
    await loadLabels(next);
    try {
      await api.preferences.patch({ locale: next });
    } catch {
      /* offline prefs */
    }
  };

  const handleThemeChange = async (next: string) => {
    const normalized = normalizeThemeId(next);
    setThemeId(normalized);
    localStorage.setItem('rxwf.themeId', normalized);
    try {
      await api.preferences.patch({ themeId: normalized, themePreference: 'fixed' });
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
    setPhase('login');
    navigate('/login', { replace: true });
  };

  const withLabels = (node: ReactNode) => (
    <LabelsProvider labels={labels}>{node}</LabelsProvider>
  );

  if (phase === 'loading') {
    return withLabels(
      <LoadingHost
        loading
        fullScreen
        className="auth-screen"
        label={t(labels, 'common.loading')}
      />,
    );
  }

  if (phase === 'setup') {
    return withLabels(<InitialSetupPage onComplete={() => void refreshAuth()} />);
  }

  if (phase === 'login') {
    return withLabels(
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => refreshAuth()} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>,
    );
  }

  if (!user) {
    return null;
  }

  if (user.mustChangePassword && !location.pathname.startsWith('/change-password')) {
    return <Navigate to="/change-password" replace />;
  }

  const settingsHost = (
    <SettingsModalHost
      user={user}
      features={features}
      locale={locale}
      themeId={themeId}
      onLocaleChange={(l) => void handleLocaleChange(l)}
      onThemeChange={(t) => void handleThemeChange(t)}
      onUserUpdate={(patch) => setUser((current) => (current ? { ...current, ...patch } : current))}
      onLogout={() => void logout()}
    />
  );

  const settingsBackground = getSettingsBackground(location.state);
  const settingsRoute = (
    <Route path="/settings/*" element={settingsHost}>
      {settingsChildRoutes(features, user)}
    </Route>
  );

  return withLabels(
    <>
      <Routes location={settingsBackground ?? location}>
      <Route path="/help/*" element={<HelpLayout />} />
      <Route path="/embed/:slug" element={<EmbedChatPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<Navigate to="/" replace />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route
        path="/change-password"
        element={<ChangePasswordRequiredPage onComplete={() => refreshAuth()} />}
      />
      <Route
        element={
          <AppShell
            user={user}
            features={features}
            labels={labels}
            locale={locale}
            themeId={themeId}
            onLocaleChange={(l) => void handleLocaleChange(l)}
            onThemeChange={(t) => void handleThemeChange(t)}
            onLogout={() => void logout()}
          />
        }
      >
        <Route path="/" element={<WorkflowListPage />} />
        <Route path="/agents" element={<Navigate to="/templates" replace />} />
        <Route
          path="/agents/:workflowId"
          element={<AgentLegacyRedirect />}
        />
        <Route path="/templates" element={<TemplateGalleryPage />} />
        <Route path="/workflows/:workflowId/executions/:executionId" element={<WorkflowEditorPage />} />
        <Route path="/workflows/:workflowId/executions" element={<WorkflowEditorPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowEditorPage />} />
        <Route path="/executions/*" element={<Navigate to="/" replace />} />
        {!settingsBackground && settingsRoute}
        <Route path="/env" element={<Navigate to="/settings/env" replace />} />
        <Route path="/runners" element={<Navigate to="/settings/runners" replace />} />
        <Route path="/users" element={<Navigate to="/settings/profile" replace />} />
        <Route path="/mcp" element={<Navigate to="/settings/mcp" replace />} />
        <Route path="/plugins" element={<Navigate to="/settings/plugins" replace />} />
        <Route path="/setup" element={<Navigate to="/settings/setup" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/bots" element={<ChatBotListPage />} />
        <Route path="/chat/bots/:botId" element={<ChatBotEditorPage />} />
        <Route path="/chat/bots/:botId/publish" element={<ChatBotPublishPage />} />
        <Route path="/knowledge" element={<KnowledgeListPage />} />
        <Route path="/knowledge/:kbId" element={<KnowledgeDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      {settingsBackground && (
        <Routes>
          {settingsRoute}
        </Routes>
      )}
    </>,
  );
}
