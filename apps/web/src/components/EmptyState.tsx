import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type EmptyStateIcon =
  | 'workflow'
  | 'execution'
  | 'credential'
  | 'env'
  | 'chat'
  | 'plugin'
  | 'runner'
  | 'search'
  | 'ollama';

const ICON_GLYPH: Record<EmptyStateIcon, string> = {
  workflow: '◇',
  execution: '▶',
  credential: '🔑',
  env: '◎',
  chat: '💬',
  plugin: '🧩',
  runner: '⚙',
  search: '⌕',
  ollama: '🤖',
};

export function EmptyState({
  icon = 'workflow',
  title,
  description,
  children,
  actions,
}: {
  icon?: EmptyStateIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon" aria-hidden>
        {ICON_GLYPH[icon]}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {children}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}

export function EmptyStateLink({
  to,
  children,
  primary,
}: {
  to: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link to={to} className={primary ? 'btn-primary' : 'btn-secondary'}>
      {children}
    </Link>
  );
}
