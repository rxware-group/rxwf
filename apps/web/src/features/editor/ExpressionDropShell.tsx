import type { CSSProperties, ReactNode, Ref } from 'react';
import {
  useExpressionDropHandlers,
  insertAtCaret,
  type ExpressionInsertFormat,
} from './use-expression-drop-target.js';

export function ExpressionDropShell({
  value,
  onInsert,
  getCaret,
  children,
  className,
  containerRef,
  style,
  insertFormat = 'template',
}: {
  value: string;
  onInsert: (next: string) => void;
  getCaret: () => number;
  children: ReactNode;
  className?: string;
  containerRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  /** `js` = bare `$xxx` for Code node; `template` = `{{ $xxx }}` (default). */
  insertFormat?: ExpressionInsertFormat;
}) {
  const { onDragOver, onDrop } = useExpressionDropHandlers(
    (text, caret) => {
      onInsert(insertAtCaret(value, text, caret));
    },
    getCaret,
    insertFormat,
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
