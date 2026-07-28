import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useVerticalSplitter(initialTopPct = 55) {
  const [topPct, setTopPct] = useState(initialTopPct);

  const startDrag = useCallback(
    (e: ReactMouseEvent, containerEl: HTMLElement | null) => {
      e.preventDefault();
      const rect = containerEl?.getBoundingClientRect();
      if (!rect) return;
      const move = (ev: MouseEvent) => {
        setTopPct(clamp(((ev.clientY - rect.top) / rect.height) * 100, 20, 80));
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

  return { topPct, startDrag };
}
