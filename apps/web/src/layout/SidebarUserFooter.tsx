import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t, useLabels } from '../i18n/labels.js';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AuthUser, SystemFeatures } from '../api/client.js';
import { settingsModalState } from '../features/settings/settings-location-state.js';
import { APP_LOCALES, LOCALE_LABELS } from '../i18n/locales.js';

const THEMES = ['dark', 'light'] as const;

function displayName(user: AuthUser): string {
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const local = user.email.split('@')[0] ?? user.email;
  return local.replace(/[._]/g, ' ').trim() || user.email;
}

function planLabel(features: SystemFeatures | null): string {
  if (!features) return '…';
  return features.deployProfile === 'standard' ? 'Standard' : 'Lite';
}

function avatarLetter(user: AuthUser): string {
  const nick = user.nickname?.trim();
  if (nick) {
    const ch = nick[0];
    return ch ? ch.toUpperCase() : '?';
  }
  const ch = user.email.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function LanguageIcon() {
  return (
    <svg
      className="sidebar-user-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg
      className="sidebar-user-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      className="sidebar-user-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.25a2.75 2.75 0 0 1 5 1.5c0 2-2.75 2-2.75 4" />
      <circle cx="12" cy="17.25" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="sidebar-user-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      className="sidebar-user-menu-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="sidebar-user-menu-chevron"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="sidebar-user-submenu-check"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SubmenuRow({
  id,
  icon,
  label,
  openSubmenu,
  onOpen,
  children,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  openSubmenu: string | null;
  onOpen: (id: string | null) => void;
  children: ReactNode;
}) {
  const isOpen = openSubmenu === id;

  return (
    <div
      className={`sidebar-user-menu-row${isOpen ? ' is-open' : ''}`}
      data-submenu={id}
      onMouseEnter={() => onOpen(id)}
      onMouseLeave={() => onOpen(null)}
    >
      <button
        type="button"
        role="menuitem"
        className="sidebar-user-menu-item"
        tabIndex={-1}
        onClick={() => onOpen(id)}
      >
        {icon}
        <span className="sidebar-user-menu-label">{label}</span>
        <ChevronRightIcon />
      </button>
      {isOpen ? (
        <div className="sidebar-user-submenu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SubmenuOption({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={`sidebar-user-submenu-item${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="sidebar-user-submenu-check-slot">{selected ? <CheckIcon /> : null}</span>
      <span>{label}</span>
    </button>
  );
}

export function SidebarUserFooter({
  user,
  features,
  locale,
  themeId,
  onLocaleChange,
  onThemeChange,
  onLogout,
}: {
  user: AuthUser;
  features: SystemFeatures | null;
  locale: string;
  themeId: string;
  onLocaleChange: (locale: string) => void;
  onThemeChange: (themeId: string) => void;
  onLogout: () => void;
}) {
  const labels = useLabels();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const profileTitle = `${displayName(user)} · ${planLabel(features)}`;

  const openSettings = () => {
    navigate('/settings/profile', { state: settingsModalState(location) });
  };

  const openHelp = () => {
    window.open('/help', '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setOpenSubmenu(null);
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setOpenSubmenu(null);
  };

  const onMenuAction = (key: string) => {
    closeMenu();
    if (key === 'settings') openSettings();
    else if (key === 'help') openHelp();
    else if (key === 'logout') onLogout();
  };

  const selectLocale = (next: string) => {
    if (next !== locale) onLocaleChange(next);
    closeMenu();
  };

  const selectTheme = (next: string) => {
    if (next !== themeId) onThemeChange(next);
    closeMenu();
  };

  return (
    <div className="sidebar-footer">
      <div ref={wrapRef} className="sidebar-user-menu-wrap">
        <button
          type="button"
          className={`sidebar-user-avatar-btn${open ? ' is-open' : ''}`}
          aria-label={profileTitle}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="sidebar-user-avatar sidebar-user-avatar--img"
            />
          ) : (
            <span className="sidebar-user-avatar" aria-hidden>
              {avatarLetter(user)}
            </span>
          )}
        </button>
        {open ? (
          <div className="sidebar-user-menu" role="menu">
            <SubmenuRow
              id="language"
              icon={<LanguageIcon />}
              label={t(labels, 'settings.appearance.language')}
              openSubmenu={openSubmenu}
              onOpen={setOpenSubmenu}
            >
              {APP_LOCALES.map((code) => (
                <SubmenuOption
                  key={code}
                  selected={locale === code}
                  label={LOCALE_LABELS[code]}
                  onSelect={() => selectLocale(code)}
                />
              ))}
            </SubmenuRow>
            <SubmenuRow
              id="theme"
              icon={<ThemeIcon />}
              label={t(labels, 'settings.appearance.theme')}
              openSubmenu={openSubmenu}
              onOpen={setOpenSubmenu}
            >
              {THEMES.map((theme) => (
                <SubmenuOption
                  key={theme}
                  selected={themeId === theme}
                  label={
                    theme === 'dark'
                      ? t(labels, 'settings.appearance.themeDark')
                      : t(labels, 'settings.appearance.themeLight')
                  }
                  onSelect={() => selectTheme(theme)}
                />
              ))}
            </SubmenuRow>
            <div className="sidebar-user-menu-row">
              <button
                type="button"
                role="menuitem"
                className="sidebar-user-menu-item"
                onClick={() => onMenuAction('settings')}
              >
                <SettingsIcon />
                <span className="sidebar-user-menu-label">{t(labels, 'settings.title')}</span>
              </button>
            </div>
            <div className="sidebar-user-menu-row">
              <button
                type="button"
                role="menuitem"
                className="sidebar-user-menu-item"
                onClick={() => onMenuAction('help')}
              >
                <HelpIcon />
                <span className="sidebar-user-menu-label">{t(labels, 'common.help')}</span>
              </button>
            </div>
            <div className="sidebar-user-menu-separator" role="separator" />
            <div className="sidebar-user-menu-row">
              <button
                type="button"
                role="menuitem"
                className="sidebar-user-menu-item"
                onClick={() => onMenuAction('logout')}
              >
                <LogOutIcon />
                <span className="sidebar-user-menu-label">{t(labels, 'settings.profile.logout')}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
