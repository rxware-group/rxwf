import { useLocation, type Location } from 'react-router-dom';

export type SettingsModalLocationState = {
  background?: Location;
};

export function getSettingsBackground(
  state: unknown,
): Location | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const bg = (state as SettingsModalLocationState).background;
  if (!bg || typeof bg !== 'object' || typeof bg.pathname !== 'string') {
    return undefined;
  }
  return bg;
}

export function settingsModalState(
  background: Location | undefined,
): SettingsModalLocationState | undefined {
  return background ? { background } : undefined;
}

export function useSettingsBackground(): Location | undefined {
  const location = useLocation();
  return getSettingsBackground(location.state);
}

export function settingsCloseTarget(
  state: unknown,
  fallback = '/',
): Pick<Location, 'pathname' | 'search' | 'hash'> & { state: unknown } {
  const background = getSettingsBackground(state);
  if (background) {
    return {
      pathname: background.pathname,
      search: background.search,
      hash: background.hash,
      state: background.state ?? null,
    };
  }
  if (state && typeof state === 'object' && 'from' in state) {
    const from = (state as { from?: string }).from;
    if (from && !from.startsWith('/settings')) {
      return { pathname: from, search: '', hash: '', state: null };
    }
  }
  return { pathname: fallback, search: '', hash: '', state: null };
}
