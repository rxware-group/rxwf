import type { CSSProperties, ReactNode } from 'react';
import { useSettingsNavTitle } from './use-settings-nav-title.js';

export function SettingsPageShell({
  children,
  lead,
  title,
  titleKey,
  className,
}: {
  children: ReactNode;
  lead?: ReactNode;
  /** Explicit page title (overrides nav lookup). */
  title?: string;
  /** i18n key for page title (overrides nav lookup). */
  titleKey?: string;
  className?: string;
}) {
  const pageTitle = useSettingsNavTitle(titleKey, title);
  const rootClass = ['settings-page', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {pageTitle ? (
        <h1 className="settings-page-title rxwf-type-page-title">{pageTitle}</h1>
      ) : null}
      {lead}
      {children}
    </div>
  );
}

export function SettingsSection({
  children,
  title,
  className,
  style,
}: {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const sectionClass = ['panel', 'settings-panel', className].filter(Boolean).join(' ');

  return (
    <section className={sectionClass} style={style}>
      {title ? <h2 className="settings-section-title rxwf-type-section-title">{title}</h2> : null}
      {children}
    </section>
  );
}
