const themes: Record<string, Record<string, string>> = {
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

export function listThemes(): string[] {
  return Object.keys(themes);
}

const overrides: Record<string, Record<string, string>> = {};

export function getThemeTokens(theme: string): Record<string, string> {
  const base = themes[theme] ?? themes['light'] ?? {};
  return { ...base, ...(overrides[theme] ?? {}) };
}

export function setThemeOverrides(theme: string, tokens: Record<string, string>): void {
  overrides[theme] = { ...(overrides[theme] ?? {}), ...tokens };
}
