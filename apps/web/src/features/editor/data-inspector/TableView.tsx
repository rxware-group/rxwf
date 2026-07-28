import { parseExprDrag, RXWF_EXPR_DRAG_MIME } from '../drag-expression.js';
import type { WorkflowItem } from '../editor-debug-types.js';
import type { DataInspectorSource } from './types.js';

function cellPreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function TableView({
  items,
  source,
  draggable = false,
  buildDragExpression,
}: {
  items: WorkflowItem[];
  source?: DataInspectorSource;
  draggable?: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
}) {
  if (items.length === 0) {
    return <p className="hint">—</p>;
  }

  const keys = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item.json)) {
      keys.add(key);
    }
  }
  const columns = [...keys];

  if (columns.length === 0) {
    return <p className="hint">—</p>;
  }

  return (
    <div className="data-inspector-table-wrap">
      <table className="data-inspector-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const dragPayload =
                source && buildDragExpression
                  ? buildDragExpression([col], source)
                  : undefined;
              const canDrag = draggable && Boolean(dragPayload);
              const onDragStart = (e: React.DragEvent) => {
                if (!canDrag || !dragPayload) return;
                e.dataTransfer.setData(RXWF_EXPR_DRAG_MIME, dragPayload);
                e.dataTransfer.effectAllowed = 'copy';
              };
              return (
                <th
                  key={col}
                  className={canDrag ? 'data-inspector-col--draggable' : undefined}
                  draggable={canDrag}
                  onDragStart={onDragStart}
                  title={
                    canDrag && dragPayload
                      ? parseExprDrag(dragPayload)?.expression
                      : undefined
                  }
                >
                  {col}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col}>
                  <pre className="data-inspector-table-cell">
                    {cellPreview(item.json[col])}
                  </pre>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
