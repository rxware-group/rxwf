import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { t, useLabels } from '../../i18n/labels.js';
import { findSettingsNavItem } from './settings-nav-config.js';

export function useSettingsNavTitle(titleKey?: string, title?: string): string {
  const labels = useLabels();
  const { pathname } = useLocation();

  return useMemo(() => {
    if (title) return title;
    if (titleKey) return t(labels, titleKey);
    const item = findSettingsNavItem(pathname);
    if (item) return t(labels, item.labelKey) || item.labelFallback;
    return '';
  }, [labels, pathname, title, titleKey]);
}
