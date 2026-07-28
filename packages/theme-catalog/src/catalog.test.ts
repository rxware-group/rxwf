import { describe, it, expect } from 'vitest';
import { getThemeTokens, listThemes } from './catalog.js';

const SEMANTIC_TOKENS = [
  '--rxwf-bg',
  '--rxwf-fg',
  '--rxwf-accent',
  '--rxwf-border',
  '--rxwf-surface',
  '--rxwf-surface-raised',
  '--rxwf-surface-hover',
  '--rxwf-text-muted',
  '--rxwf-edge',
  '--rxwf-grid',
  '--rxwf-shadow',
] as const;

describe('theme catalog', () => {
  it('lists dark and light themes', () => {
    expect(listThemes()).toEqual(['dark', 'light']);
  });

  it('exposes full CSS variable set for dark theme', () => {
    const tokens = getThemeTokens('dark');
    for (const key of SEMANTIC_TOKENS) {
      expect(tokens[key]).toBeTruthy();
    }
    expect(tokens['--rxwf-bg']).toBe('#0f1117');
    expect(tokens['--rxwf-accent']).toBe('#f97316');
  });

  it('exposes full CSS variable set for light theme', () => {
    const tokens = getThemeTokens('light');
    for (const key of SEMANTIC_TOKENS) {
      expect(tokens[key]).toBeTruthy();
    }
    expect(tokens['--rxwf-bg']).toBe('#ffffff');
    expect(tokens['--rxwf-surface']).toBe('#f6f8fa');
    expect(tokens['--rxwf-accent']).toBe('#ea580c');
  });
});
