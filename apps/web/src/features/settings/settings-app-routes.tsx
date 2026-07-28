import { Navigate, Route } from 'react-router-dom';
import type { AuthUser, SystemFeatures } from '../../api/client.js';
import { EnvPage } from '../env/EnvPage.js';
import { VariablesPage } from '../variables/VariablesPage.js';
import { McpServersPage } from '../mcp/McpServersPage.js';
import { PluginsPage } from '../plugins/PluginsPage.js';
import { RxwfSettingsPage } from '../rxwf/RxwfSettingsPage.js';
import { SetupPage } from '../setup/SetupPage.js';
import { RunnerListPage } from '../runners/RunnerListPage.js';
import { AdminGuard } from './AdminGuard.js';
import { AdminI18nPage } from './AdminI18nPage.js';
import { AdminThemePage } from './AdminThemePage.js';
import { CredentialsPage } from './CredentialsPage.js';
import { KnowledgeSettingsPage } from './KnowledgeSettingsPage.js';
import { WebSearchSettings } from './WebSearchSettings.js';
import { McpTokensPage } from './McpTokensPage.js';
import { ModelCatalogPage } from './ModelCatalogPage.js';
import { SettingsLayout } from './SettingsLayout.js';
import { SettingsProfilePage } from './SettingsProfilePage.js';
import { SystemSettingsPage } from './SystemSettingsPage.js';
import { RolesReferencePage } from './RolesReferencePage.js';
import { UsersAdminPage } from './UsersAdminPage.js';
import { AgentMemoryListPage } from './AgentMemoryListPage.js';
import { AgentMemorySessionPage } from './AgentMemorySessionPage.js';

/** Nested routes under `path="/settings"` — must be direct `<Route>` children, not wrapped in a component. */
export function settingsChildRoutes(
  features: SystemFeatures | null,
  user: AuthUser,
) {
  return (
    <Route element={<SettingsLayout />}>
      <Route index element={<Navigate to="profile" replace />} />
      <Route path="appearance" element={<Navigate to="/settings/profile" replace />} />
      <Route path="profile" element={<SettingsProfilePage />} />
      <Route element={<AdminGuard />}>
        <Route path="users" element={<UsersAdminPage />} />
        <Route path="agent-memory" element={<AgentMemoryListPage />} />
        <Route path="agent-memory/:sessionId" element={<AgentMemorySessionPage />} />
      </Route>
      <Route path="roles" element={<RolesReferencePage />} />
      <Route path="variables" element={<VariablesPage />} />
      <Route path="env" element={<EnvPage />} />
      <Route path="runners" element={<RunnerListPage />} />
      <Route path="credentials" element={<CredentialsPage />} />
      <Route
        path="mcp-tokens"
        element={
          <McpTokensPage publicUrl={features?.publicUrl ?? 'http://localhost:8787'} />
        }
      />
      <Route path="models" element={<ModelCatalogPage />} />
      <Route path="models/ollama" element={<Navigate to="/settings/models" replace />} />
      <Route path="knowledge" element={<KnowledgeSettingsPage />} />
      <Route path="langsmith" element={<Navigate to="/settings/env" replace />} />
      <Route path="web-search" element={<WebSearchSettings />} />
      <Route path="mcp" element={<McpServersPage />} />
      <Route path="plugins" element={<PluginsPage />} />
      <Route path="rxwf" element={<RxwfSettingsPage />} />
      {user.role === 'admin' && (
        <>
          <Route path="system" element={<SystemSettingsPage />} />
          <Route path="admin/i18n" element={<AdminI18nPage />} />
          <Route path="admin/theme" element={<AdminThemePage />} />
        </>
      )}
      <Route path="setup" element={<SetupPage />} />
    </Route>
  );
}
