import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

const STORAGE_KEY = 'rxwf.settings.navWidthPct';
const DEFAULT_PCT = 24;
const MIN_PCT = 18;
const MAX_PCT = 40;

function readStoredPct(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return DEFAULT_PCT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_PCT;
  return Math.min(MAX_PCT, Math.max(MIN_PCT, n));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useSettingsSplitter() {
  const [navWidthPct, setNavWidthPct] = useState(readStoredPct);

  const startNavDrag = useCallback(
    (e: ReactMouseEvent, containerEl: HTMLElement | null) => {
      e.preventDefault();
      const rect = containerEl?.getBoundingClientRect();
      if (!rect) return;

      const move = (ev: MouseEvent) => {
        const pct = clamp(((ev.clientX - rect.left) / rect.width) * 100, MIN_PCT, MAX_PCT);
        setNavWidthPct(pct);
        localStorage.setItem(STORAGE_KEY, String(pct));
      };

      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };

      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [],
  );

  return { navWidthPct, startNavDrag };
}
