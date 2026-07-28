import { useCallback } from 'react';
import {
  parseExprDrag,
  RXWF_EXPR_DRAG_MIME,
  toCodeJsInsertText,
} from './drag-expression.js';

export type ExpressionInsertFormat = 'template' | 'js';

export function useExpressionDropHandlers(
  onInsert: (text: string, caret: number) => void,
  getCaret: () => number,
  insertFormat: ExpressionInsertFormat = 'template',
) {
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(RXWF_EXPR_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(RXWF_EXPR_DRAG_MIME);
      const payload = parseExprDrag(raw);
      if (!payload) return;
      e.preventDefault();
      const caret = getCaret();
      const text =
        insertFormat === 'js'
          ? toCodeJsInsertText(payload.expression)
          : payload.expression;
      onInsert(text, caret);
    },
    [getCaret, insertFormat, onInsert],
  );

  return { onDragOver, onDrop };
}

export function insertAtCaret(value: string, insert: string, caret: number): string {
  return value.slice(0, caret) + insert + value.slice(caret);
}
