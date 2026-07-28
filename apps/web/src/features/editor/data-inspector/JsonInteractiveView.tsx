import { useState } from 'react';
import { parseExprDrag, RXWF_EXPR_DRAG_MIME } from '../drag-expression.js';
import type { DataInspectorSource } from './types.js';
import { toExpressionPath } from './json-expression-path.js';

function JsonDragToken({
  label,
  path,
  itemCount,
  source,
  draggable,
  buildDragExpression,
  kind,
}: {
  label: string;
  path: string[];
  itemCount: number;
  source: DataInspectorSource;
  draggable: boolean;
  buildDragExpression: (path: string[], source: DataInspectorSource) => string;
  kind: 'key' | 'index';
}) {
  const exprPath = toExpressionPath(path, itemCount);
  const payload = buildDragExpression(exprPath, source);
  const expression = parseExprDrag(payload)?.expression;
  const canDrag = draggable && Boolean(payload);

  const onDragStart = (e: React.DragEvent) => {
    if (!canDrag) return;
    e.dataTransfer.setData(RXWF_EXPR_DRAG_MIME, payload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <span
      className={
        canDrag
          ? kind === 'key'
            ? 'json-key--draggable'
            : 'json-index--draggable'
          : kind === 'key'
            ? 'json-key'
            : 'json-index'
      }
      draggable={canDrag}
      onDragStart={onDragStart}
      title={expression}
    >
      {kind === 'key' ? `"${label}"` : label}
    </span>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="json-primitive json-primitive--string">{JSON.stringify(value)}</span>;
  }
  if (value === null) {
    return <span className="json-primitive json-primitive--null">null</span>;
  }
  return (
    <span className="json-primitive json-primitive--literal">{JSON.stringify(value)}</span>
  );
}

function JsonNode({
  value,
  path,
  depth,
  itemCount,
  source,
  draggable,
  buildDragExpression,
}: {
  value: unknown;
  path: string[];
  depth: number;
  itemCount: number;
  source: DataInspectorSource;
  draggable: boolean;
  buildDragExpression: (path: string[], source: DataInspectorSource) => string;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="json-bracket">[]</span>;
    }
    return (
      <span className="json-block">
        <button
          type="button"
          className="json-fold-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="json-bracket">[</span>
        {open && (
          <div className="json-block-children">
            {value.map((entry, index) => {
              const childPath = [...path, String(index)];
              return (
                <div key={childPath.join('.')} className="json-line">
                  <JsonDragToken
                    label={String(index)}
                    path={childPath}
                    itemCount={itemCount}
                    source={source}
                    draggable={draggable}
                    buildDragExpression={buildDragExpression}
                    kind="index"
                  />
                  <span className="json-colon">: </span>
                  <JsonNode
                    value={entry}
                    path={childPath}
                    depth={depth + 1}
                    itemCount={itemCount}
                    source={source}
                    draggable={draggable}
                    buildDragExpression={buildDragExpression}
                  />
                  {index < value.length - 1 ? <span className="json-comma">,</span> : null}
                </div>
              );
            })}
          </div>
        )}
        {!open && <span className="json-ellipsis hint"> … </span>}
        <span className="json-bracket">]</span>
      </span>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="json-bracket">{'{}'}</span>;
    }
    return (
      <span className="json-block">
        <button
          type="button"
          className="json-fold-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="json-bracket">{'{'}</span>
        {open && (
          <div className="json-block-children">
            {entries.map(([key, child], index) => {
              const childPath = [...path, key];
              return (
                <div key={childPath.join('.')} className="json-line">
                  <JsonDragToken
                    label={key}
                    path={childPath}
                    itemCount={itemCount}
                    source={source}
                    draggable={draggable}
                    buildDragExpression={buildDragExpression}
                    kind="key"
                  />
                  <span className="json-colon">: </span>
                  <JsonNode
                    value={child}
                    path={childPath}
                    depth={depth + 1}
                    itemCount={itemCount}
                    source={source}
                    draggable={draggable}
                    buildDragExpression={buildDragExpression}
                  />
                  {index < entries.length - 1 ? <span className="json-comma">,</span> : null}
                </div>
              );
            })}
          </div>
        )}
        {!open && <span className="json-ellipsis hint"> … </span>}
        <span className="json-bracket">{'}'}</span>
      </span>
    );
  }

  return <JsonPrimitive value={value} />;
}

export function JsonInteractiveView({
  value,
  itemCount,
  source,
  draggable,
  buildDragExpression,
}: {
  value: unknown;
  itemCount: number;
  source: DataInspectorSource;
  draggable: boolean;
  buildDragExpression: (path: string[], source: DataInspectorSource) => string;
}) {
  return (
    <div className="json-interactive-view">
      <JsonNode
        value={value}
        path={[]}
        depth={0}
        itemCount={itemCount}
        source={source}
        draggable={draggable}
        buildDragExpression={buildDragExpression}
      />
    </div>
  );
}
