import { describe, expect, it } from 'vitest';
import { buildSettingsHelpUrl, settingsPathToHelpSlug } from './settings-help-registry.js';

const ORIGIN = 'http://localhost:5173';

describe('settings-help-registry', () => {
  it('maps main settings routes to help slugs', () => {
    expect(settingsPathToHelpSlug('/settings/profile')).toBe('settings/profile');
    expect(settingsPathToHelpSlug('/settings/variables')).toBe('settings/variables');
    expect(settingsPathToHelpSlug('/settings/admin/i18n')).toBe('settings/admin/i18n');
    expect(settingsPathToHelpSlug('/settings/web-search')).toBe('settings/web-search');
  });

  it('maps nested settings routes via longest prefix match', () => {
    expect(settingsPathToHelpSlug('/settings/agent-memory/sess-123')).toBe(
      'settings/agent-memory',
    );
  });

  it('returns null for unknown paths', () => {
    expect(settingsPathToHelpSlug('/settings/unknown-page')).toBeNull();
    expect(settingsPathToHelpSlug('/workflows')).toBeNull();
  });

  it('buildSettingsHelpUrl resolves mapped routes', () => {
    expect(buildSettingsHelpUrl('/settings/models', ORIGIN)).toBe(
      `${ORIGIN}/help/settings/models`,
    );
    expect(buildSettingsHelpUrl('/settings/knowledge', ORIGIN)).toBe(
      `${ORIGIN}/help/settings/knowledge`,
    );
  });

  it('falls back to help home for unknown paths', () => {
    expect(buildSettingsHelpUrl('/settings/unknown', ORIGIN)).toBe(`${ORIGIN}/help`);
  });
});
