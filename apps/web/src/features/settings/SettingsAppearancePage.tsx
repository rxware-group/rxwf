import { t, useLabels } from '../../i18n/labels.js';
import { useOutletContext } from 'react-router-dom';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import type { SettingsOutletContext } from './settings-context.js';

import { APP_LOCALES, LOCALE_LABELS } from '../../i18n/locales.js';

const THEMES = ['dark', 'light'] as const;

export function SettingsAppearancePage() {
  const labels = useLabels();

  const { locale, themeId, onLocaleChange, onThemeChange } =
    useOutletContext<SettingsOutletContext>();

  return (
    <div className="settings-page">
      <p className="hint settings-page-lead">{t(labels, 'settings.appearance.lead')}</p>
      <section className="panel settings-panel">
        <FormField label={t(labels, 'settings.appearance.language')}>
          <Select
            value={locale}
            onChange={(next) => {
              localStorage.setItem('rxwf.locale', next);
              onLocaleChange(next);
            }}
            options={APP_LOCALES.map((l) => ({
              value: l,
              label: LOCALE_LABELS[l],
            }))}
          />
        </FormField>
        <FormField label={t(labels, 'settings.appearance.theme')}>
          <Select
            value={themeId}
            onChange={onThemeChange}
            options={THEMES.map((theme) => ({
              value: theme,
              label:
                theme === 'dark'
                  ? t(labels, 'settings.appearance.themeDark')
                  : t(labels, 'settings.appearance.themeLight'),
            }))}
          />
        </FormField>
      </section>
    </div>
  );
}
