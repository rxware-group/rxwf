import { t } from '../i18n/labels.js';
import { NavLink, Outlet } from 'react-router-dom';
import type { AuthUser, SystemFeatures } from '../api/client.js';
import { Tooltip } from '../components/Tooltip.js';
import { SIDEBAR_NAV_ITEMS } from './sidebar-nav-config.js';
import { SidebarUserFooter } from './SidebarUserFooter.js';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link active' : 'nav-link';

export function AppShell({
  user,
  features,
  labels,
  locale,
  themeId,
  onLocaleChange,
  onThemeChange,
  onLogout,
}: {
  user: AuthUser;
  features: SystemFeatures | null;
  labels: Record<string, string>;
  locale: string;
  themeId: string;
  onLocaleChange: (locale: string) => void;
  onThemeChange: (themeId: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <Tooltip label="rxwf" side="right">
            <h1 className="brand">rxwf</h1>
          </Tooltip>
        </div>
        <nav className="sidebar-main-nav" aria-label={t(labels, 'common.mainNav')}>
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const label = item.labelKey
              ? (labels[item.labelKey] ?? item.labelFallback)
              : item.labelFallback;

            if (item.disabled) {
              return (
                <Tooltip key={item.id} label={item.disabledTitle ?? label} side="right">
                  <span className="nav-link nav-disabled" aria-label={label} aria-disabled="true">
                    {item.icon}
                    <span className="sidebar-nav-label">{label}</span>
                  </span>
                </Tooltip>
              );
            }

            return (
              <Tooltip key={item.id} label={label} side="right">
                <NavLink to={item.to!} end={item.end} className={navClass} aria-label={label}>
                  {item.icon}
                  <span className="sidebar-nav-label">{label}</span>
                </NavLink>
              </Tooltip>
            );
          })}
        </nav>
        <SidebarUserFooter
          user={user}
          features={features}
          locale={locale}
          themeId={themeId}
          onLocaleChange={onLocaleChange}
          onThemeChange={onThemeChange}
          onLogout={onLogout}
        />
      </aside>
      <div className="content-column">
        <Outlet context={{ labels } satisfies import('./app-outlet-context.js').AppOutletContext} />
      </div>
    </div>
  );
}
