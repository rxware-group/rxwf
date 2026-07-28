import { useState } from 'react';
import { RXWF_EXPR_DRAG_MIME } from '../drag-expression.js';
import type { DataInspectorSource, SchemaDisplayNode } from './types.js';
import { buildSchemaTree, type SchemaTreeNode } from './build-schema-tree.js';

function toDisplayNode(sourceId: string, node: SchemaTreeNode): SchemaDisplayNode {
  return {
    id: `${sourceId}:${node.path.join('.')}`,
    key: node.key,
    path: node.path,
    type: node.type,
    preview: node.preview,
    draggable: true,
    children: node.children?.map((child) => toDisplayNode(sourceId, child)),
  };
}

function schemaNodesFromSource(source: DataInspectorSource): SchemaDisplayNode[] {
  if (source.contextChildren) {
    return source.contextChildren;
  }
  return buildSchemaTree(source.items).map((node) => toDisplayNode(source.id, node));
}

function typeIcon(type: string): string {
  switch (type) {
    case 'string':
      return 'T';
    case 'number':
      return '#';
    case 'boolean':
      return '☑';
    case 'object':
      return '{}';
    case 'array':
      return '[]';
    default:
      return '·';
  }
}

function SchemaNode({
  node,
  source,
  draggable,
  buildDragExpression,
  searchQuery,
  depth = 0,
}: {
  node: SchemaDisplayNode;
  source: DataInspectorSource;
  draggable: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
  searchQuery: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const hay = `${node.key} ${node.path.join('.')} ${node.preview ?? ''}`.toLowerCase();
  const q = searchQuery.trim().toLowerCase();
  const childVisible =
    !q ||
    hay.includes(q) ||
    node.children?.some((c) =>
      `${c.key} ${c.path.join('.')}`.toLowerCase().includes(q),
    );

  if (!childVisible && q) {
    return null;
  }

  const dragPayload =
    node.expression ??
    (buildDragExpression && node.draggable !== false
      ? buildDragExpression(node.path, source)
      : undefined);

  const onDragStart = (e: React.DragEvent) => {
    if (!draggable || !dragPayload) return;
    e.dataTransfer.setData(RXWF_EXPR_DRAG_MIME, dragPayload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <li className="schema-tree-node">
      <div className="schema-tree-row">
        {hasChildren ? (
          <button
            type="button"
            className="schema-tree-toggle"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="schema-tree-toggle-spacer" />
        )}
        <span className="schema-tree-type" aria-hidden>
          {typeIcon(node.type)}
        </span>
        <span
          className={`schema-tree-key${draggable && dragPayload ? ' schema-tree-key--draggable' : ''}`}
          draggable={draggable && Boolean(dragPayload)}
          onDragStart={onDragStart}
        >
          {node.key}
        </span>
        {node.preview != null && (
          <span className="schema-tree-preview hint">{node.preview}</span>
        )}
      </div>
      {open && hasChildren && (
        <ul className="schema-tree-children">
          {node.children!.map((child) => (
            <SchemaNode
              key={child.id}
              node={child}
              source={source}
              draggable={draggable}
              buildDragExpression={buildDragExpression}
              searchQuery={searchQuery}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SchemaSourceItem({
  source,
  draggable,
  buildDragExpression,
  searchQuery,
}: {
  source: DataInspectorSource;
  draggable: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
  searchQuery: string;
}) {
  const [open, setOpen] = useState(true);
  const nodes = schemaNodesFromSource(source);
  const itemNote =
    source.icon !== 'context' && source.items.length > 1
      ? ` (${source.items.length} items)`
      : '';

  return (
    <li className="input-data-node schema-tree-source">
      <div className="input-data-node-head schema-tree-source-head">
        <button
          type="button"
          className="input-data-node-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="schema-tree-expand-icon" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
          <span>
            {source.label}
            {itemNote}
          </span>
        </button>
      </div>
      {open && (
        <ul className="input-data-tree-children">
          {nodes.map((node) => (
            <SchemaNode
              key={node.id}
              node={node}
              source={source}
              draggable={draggable}
              buildDragExpression={buildDragExpression}
              searchQuery={searchQuery}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SchemaTreeView({
  sources,
  draggable,
  buildDragExpression,
  searchQuery,
}: {
  sources: DataInspectorSource[];
  draggable: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
  searchQuery: string;
}) {
  return (
    <ul className="schema-tree-root input-data-tree">
      {sources.map((source) => (
        <SchemaSourceItem
          key={source.id}
          source={source}
          draggable={draggable}
          buildDragExpression={buildDragExpression}
          searchQuery={searchQuery}
        />
      ))}
    </ul>
  );
}
