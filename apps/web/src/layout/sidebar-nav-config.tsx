import type { ReactNode } from 'react';

export type SidebarNavItem = {
  id: string;
  to?: string;
  labelKey?: string;
  labelFallback: string;
  icon: ReactNode;
  end?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
};

function icon(paths: ReactNode) {
  return (
    <svg
      className="sidebar-nav-icon"
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
  workflows: icon(
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M9 6h6M12 9v6" />
    </>,
  ),
  templates: icon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>,
  ),
  chat: icon(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>,
  ),
  knowledge: icon(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>,
  ),
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'workflows',
    to: '/',
    labelKey: 'nav.workflows',
    labelFallback: 'Workflows',
    icon: Icons.workflows,
    end: true,
  },
  {
    id: 'chat',
    to: '/chat',
    labelKey: 'nav.chat',
    labelFallback: 'Chat',
    icon: Icons.chat,
    end: true,
  },
  {
    id: 'chat-bots',
    to: '/chat/bots',
    labelKey: 'nav.chatBots',
    labelFallback: 'Chat Bots',
    icon: Icons.chat,
  },
  {
    id: 'knowledge',
    to: '/knowledge',
    labelKey: 'nav.knowledge',
    labelFallback: 'Knowledge',
    icon: Icons.knowledge,
  },
  {
    id: 'templates',
    to: '/templates',
    labelKey: 'nav.templates',
    labelFallback: 'Templates',
    icon: Icons.templates,
  },
];
