import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import type { LogPanelSplit } from './use-editor-layout-prefs.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useLogPanelSplitter(
  onSplitChange: (patch: Partial<LogPanelSplit>) => void,
) {
  const startListDrag = useCallback(
    (e: ReactMouseEvent, bodyEl: HTMLElement | null) => {
      e.preventDefault();
      const rect = bodyEl?.getBoundingClientRect();
      if (!rect) return;
      const move = (ev: MouseEvent) => {
        const listPct = clamp(((ev.clientX - rect.left) / rect.width) * 100, 15, 40);
        onSplitChange({ listPct });
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [onSplitChange],
  );

  const startInputOutputDrag = useCallback(
    (e: ReactMouseEvent, ioEl: HTMLElement | null) => {
      e.preventDefault();
      const rect = ioEl?.getBoundingClientRect();
      if (!rect) return;
      const move = (ev: MouseEvent) => {
        const inputPct = clamp(((ev.clientX - rect.left) / rect.width) * 100, 20, 80);
        onSplitChange({ inputPct });
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [onSplitChange],
  );

  const startIoCodeDrag = useCallback(
    (e: ReactMouseEvent, detailEl: HTMLElement | null) => {
      e.preventDefault();
      const rect = detailEl?.getBoundingClientRect();
      if (!rect) return;
      const move = (ev: MouseEvent) => {
        const ioTopPct = clamp(((ev.clientY - rect.top) / rect.height) * 100, 25, 75);
        onSplitChange({ ioTopPct });
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    [onSplitChange],
  );

  return { startListDrag, startInputOutputDrag, startIoCodeDrag };
}
