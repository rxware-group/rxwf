import { useCallback, useState } from 'react';
import type { ModalColumnWeights } from './node-editor-split.js';

/** Column flex-grow weights for the node editor modal (equal = 1:1:1 or 0:1:1). */
export function useHorizontalSplitter(initial: ModalColumnWeights) {
  const [widths, setWidths] = useState(initial);

  const onDragDivider = useCallback(
    (
      dividerIndex: 0 | 1,
      clientX: number,
      containerRect: DOMRect,
      twoColumn: boolean,
    ) => {
      const ratio = Math.min(
        0.85,
        Math.max(0.15, (clientX - containerRect.left) / containerRect.width),
      );
      setWidths((prev) => {
        if (twoColumn) {
          const total = prev[1] + prev[2];
          const left = ratio * total;
          return [0, left, total - left];
        }
        const next: ModalColumnWeights = [...prev];
        const total = prev[0] + prev[1] + prev[2];
        if (dividerIndex === 0) {
          const left = ratio * total;
          const rest = (1 - ratio) * total;
          const midRatio = prev[1] / (prev[1] + prev[2]);
          next[0] = left;
          next[1] = rest * midRatio;
          next[2] = rest * (1 - midRatio);
        } else {
          const leftAndMid = ratio * total;
          next[1] = leftAndMid - prev[0];
          next[2] = total - leftAndMid;
        }
        return next;
      });
    },
    [],
  );

  return { widths, setWidths, onDragDivider };
}
