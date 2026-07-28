import { t, useLabels } from '../../i18n/labels.js';
import { SettingsNavLink } from './SettingsLink.js';
import type { AuthUser, SystemFeatures } from '../../api/client.js';
import { filterSettingsNavGroups } from './settings-nav-config.js';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'settings-nav-link active' : 'settings-nav-link';
}

export function SettingsNav({
  user,
  features,
}: {
  user: AuthUser;
  features: SystemFeatures | null;
}) {
  const labels = useLabels();

  const groups = filterSettingsNavGroups(user, features);

  return (
    <nav className="settings-nav" aria-label={t(labels, 'settings.nav.aria')}>
      {groups.map((group, gi) => (
        <div key={gi} className="settings-nav-group">
          {group.items.map((item) => (
            <SettingsNavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.icon}
              <span className="settings-nav-label">
                {t(labels, item.labelKey) || item.labelFallback}
              </span>
            </SettingsNavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
