import { buildHelpUrl } from '../help/help-registry.js';
import { findSettingsNavItem } from './settings-nav-config.js';

export function settingsPathToHelpSlug(pathname: string): string | null {
  const item = findSettingsNavItem(pathname);
  if (!item) return null;
  return item.to.replace(/^\//, '');
}

export function buildSettingsHelpUrl(pathname: string, origin?: string): string {
  const slug = settingsPathToHelpSlug(pathname);
  return buildHelpUrl({ path: slug ? `/help/${slug}` : '/help', origin });
}
