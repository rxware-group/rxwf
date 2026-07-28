import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export const THEME_TOKENS_UPDATED = 'rxwf-theme-tokens-updated';

const VALID_THEME_IDS = new Set(['dark', 'light']);

const FALLBACK_THEME_TOKENS: Record<string, Record<string, string>> = {
  dark: {
    '--rxwf-bg': '#0f1117',
    '--rxwf-fg': '#e6edf3',
    '--rxwf-accent': '#f97316',
    '--rxwf-border': '#30363d',
    '--rxwf-surface': '#161b22',
    '--rxwf-surface-raised': '#1c2128',
    '--rxwf-surface-hover': '#21262d',
    '--rxwf-text-muted': '#8b949e',
    '--rxwf-edge': '#6e7681',
    '--rxwf-grid': '#30363d',
    '--rxwf-shadow': 'rgba(0, 0, 0, 0.45)',
  },
  light: {
    '--rxwf-bg': '#ffffff',
    '--rxwf-fg': '#1f2328',
    '--rxwf-accent': '#ea580c',
    '--rxwf-border': '#d0d7de',
    '--rxwf-surface': '#f6f8fa',
    '--rxwf-surface-raised': '#ffffff',
    '--rxwf-surface-hover': '#eef1f4',
    '--rxwf-text-muted': '#656d76',
    '--rxwf-edge': '#afb8c1',
    '--rxwf-grid': '#d0d7de',
    '--rxwf-shadow': 'rgba(0, 0, 0, 0.12)',
  },
};

const THEME_TOKEN_KEYS = [
  ...new Set([
    ...Object.keys(FALLBACK_THEME_TOKENS.dark),
    ...Object.keys(FALLBACK_THEME_TOKENS.light),
  ]),
];

export function normalizeThemeId(themeId: string | null | undefined): string {
  const id = themeId?.trim();
  return id && VALID_THEME_IDS.has(id) ? id : 'dark';
}

export function readStoredThemeId(): string {
  return normalizeThemeId(localStorage.getItem('rxwf.themeId'));
}

function applyThemeTokens(themeId: string, tokens: Record<string, string>): void {
  const root = document.documentElement;
  root.setAttribute('data-theme-id', themeId);
  for (const key of THEME_TOKEN_KEYS) {
    root.style.removeProperty(key);
  }
  for (const [key, value] of Object.entries(tokens)) {
    if (value) root.style.setProperty(key, value);
  }
  root.dispatchEvent(new Event(THEME_TOKENS_UPDATED));
}

/** 将主题 id 与 token 写入 document，供全局样式与画布读取。 */
export async function applyThemeId(themeId: string): Promise<void> {
  const normalized = normalizeThemeId(themeId);
  try {
    const tokens = await api.themes.tokens(normalized);
    applyThemeTokens(normalized, tokens);
  } catch {
    applyThemeTokens(
      normalized,
      FALLBACK_THEME_TOKENS[normalized] ?? FALLBACK_THEME_TOKENS.dark,
    );
  }
}

export function readThemeToken(name: string, fallback = ''): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function useThemeId(): string {
  const [themeId, setThemeId] = useState(
    () => document.documentElement.getAttribute('data-theme-id') ?? 'dark',
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setThemeId(root.getAttribute('data-theme-id') ?? 'dark');
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme-id'] });
    root.addEventListener(THEME_TOKENS_UPDATED, sync);
    return () => {
      observer.disconnect();
      root.removeEventListener(THEME_TOKENS_UPDATED, sync);
    };
  }, []);

  return themeId;
}

/** Bumps when theme id or injected CSS tokens change (for JS color reads). */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const bump = () => setVersion((v) => v + 1);
    const observer = new MutationObserver(bump);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme-id'] });
    root.addEventListener(THEME_TOKENS_UPDATED, bump);
    return () => {
      observer.disconnect();
      root.removeEventListener(THEME_TOKENS_UPDATED, bump);
    };
  }, []);

  return version;
}
