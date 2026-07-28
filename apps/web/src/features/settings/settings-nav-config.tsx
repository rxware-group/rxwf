import type { ReactNode } from 'react';
import type { AuthUser, SystemFeatures } from '../../api/client.js';

export type SettingsNavItem = {
  to: string;
  labelKey: string;
  labelFallback: string;
  icon: ReactNode;
  end?: boolean;
  adminOnly?: boolean;
};

function icon(paths: ReactNode) {
  return (
    <svg
      className="settings-nav-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}

const Icons = {
  overview: icon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
  ),
  appearance: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>,
  ),
  profile: icon(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </>,
  ),
  variables: icon(
    <>
      <path d="M4 7h16M4 12h10M4 17h6" />
      <circle cx="18" cy="17" r="3" />
    </>,
  ),
  env: icon(
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </>,
  ),
  runners: icon(
    <>
      <rect x="2" y="3" width="20" height="6" rx="1" />
      <rect x="2" y="15" width="20" height="6" rx="1" />
      <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
    </>,
  ),
  credentials: icon(
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>,
  ),
  plugins: icon(
    <>
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>,
  ),
  rxwf: icon(
    <>
      <path d="M4 19h16M4 12h10M4 5h6" />
      <path d="M14 5l6 7-6 7" />
    </>,
  ),
  mcp: icon(
    <>
      <path d="M12 22v-6M8 12H4M20 12h-4M16 6l-4 4-4-4" />
      <path d="M8 18l4-4 4 4" />
    </>,
  ),
  mcpToken: icon(
    <>
      <path d="M4 7h16M4 12h10M4 17h6" />
      <circle cx="18" cy="17" r="3" />
    </>,
  ),
  models: icon(
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </>,
  ),
  knowledge: icon(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </>,
  ),
  webSearch: icon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>,
  ),
  setup: icon(
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>,
  ),
  i18n: icon(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </>,
  ),
  theme: icon(
    <>
      <path d="M12 3a6 6 0 0 0 0 18 6 6 0 0 1 0-18z" />
    </>,
  ),
  users: icon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  agentMemory: icon(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 14h5" />
    </>,
  ),
  roles: icon(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>,
  ),
};

export const SETTINGS_NAV_GROUPS: { items: SettingsNavItem[] }[] = [
  {
    items: [
      {
        to: '/settings/profile',
        labelKey: 'settings.nav.profile',
        labelFallback: 'My',
        icon: Icons.profile,
        end: true,
      },
    ],
  },
  {
    items: [
      { to: '/settings/users', labelKey: 'settings.nav.users', labelFallback: 'Users', icon: Icons.users, adminOnly: true },
      { to: '/settings/roles', labelKey: 'settings.nav.roles', labelFallback: 'Roles', icon: Icons.roles, adminOnly: true },
      {
        to: '/settings/agent-memory',
        labelKey: 'settings.nav.agentMemory',
        labelFallback: 'Agent Memory',
        icon: Icons.agentMemory,
        adminOnly: true,
      },
    ],
  },
  {
    items: [
      { to: '/settings/variables', labelKey: 'settings.nav.variables', labelFallback: 'Variables', icon: Icons.variables },
      { to: '/settings/env', labelKey: 'settings.nav.env', labelFallback: 'Environment variables', icon: Icons.env, adminOnly: true },
      { to: '/settings/runners', labelKey: 'settings.nav.runners', labelFallback: 'Runners', icon: Icons.runners },
      { to: '/settings/credentials', labelKey: 'settings.nav.credentials', labelFallback: 'Credentials', icon: Icons.credentials },
    ],
  },
  {
    items: [
      { to: '/settings/plugins', labelKey: 'settings.nav.plugins', labelFallback: 'Plugins', icon: Icons.plugins },
      { to: '/settings/mcp', labelKey: 'settings.nav.mcp', labelFallback: 'MCP', icon: Icons.mcp },
      {
        to: '/settings/rxwf',
        labelKey: 'settings.nav.rxwf',
        labelFallback: 'RxWF / Skills',
        icon: Icons.rxwf,
      },
      { to: '/settings/mcp-tokens', labelKey: 'settings.nav.mcpTokens', labelFallback: 'MCP Token', icon: Icons.mcpToken },
      { to: '/settings/models', labelKey: 'settings.nav.models', labelFallback: 'Models', icon: Icons.models },
      {
        to: '/settings/knowledge',
        labelKey: 'settings.nav.knowledge',
        labelFallback: 'Knowledge',
        icon: Icons.knowledge,
      },
      {
        to: '/settings/web-search',
        labelKey: 'settings.nav.webSearch',
        labelFallback: 'Web Search',
        icon: Icons.webSearch,
        adminOnly: true,
      },
    ],
  },
  {
    items: [
      { to: '/settings/setup', labelKey: 'settings.nav.setup', labelFallback: 'Setup', icon: Icons.setup },
      { to: '/settings/admin/i18n', labelKey: 'settings.nav.i18nAdmin', labelFallback: 'i18n (Admin)', icon: Icons.i18n, adminOnly: true },
      { to: '/settings/admin/theme', labelKey: 'settings.nav.themeAdmin', labelFallback: 'Theme (Admin)', icon: Icons.theme, adminOnly: true },
    ],
  },
];

export function filterSettingsNavGroups(
  user: AuthUser,
  _features: SystemFeatures | null,
): { items: SettingsNavItem[] }[] {
  const isAdmin = user.role === 'admin';

  return SETTINGS_NAV_GROUPS.map((group) => ({
    items: group.items.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}

/** Longest-prefix match for settings detail page titles (same source as left nav). */
export function findSettingsNavItem(pathname: string): SettingsNavItem | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  let best: SettingsNavItem | undefined;
  let bestLen = -1;

  for (const group of SETTINGS_NAV_GROUPS) {
    for (const item of group.items) {
      const to = item.to.replace(/\/+$/, '') || '/';
      const matches =
        normalized === to || (item.end !== true && normalized.startsWith(`${to}/`));
      if (matches && to.length > bestLen) {
        best = item;
        bestLen = to.length;
      }
    }
  }

  return best;
}
