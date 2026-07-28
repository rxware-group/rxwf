import { useMemo, useState } from 'react';
import { itemsForDebugDisplay } from '../editor-debug-types.js';
import { JsonView } from './JsonView.js';
import { JsonInteractiveView } from './JsonInteractiveView.js';
import type { DataInspectorProps } from './types.js';

export function DataInspector({
  sources,
  activeSourceId: activeSourceIdProp,
  onActiveSourceChange,
  searchQuery = '',
  jsonHeightMode = 'content',
  draggable = false,
  buildDragExpression,
}: DataInspectorProps) {
  const [internalActiveId, setInternalActiveId] = useState(() => sources[0]?.id ?? '');

  const activeSourceId = activeSourceIdProp ?? internalActiveId;
  const setActiveSourceId = onActiveSourceChange ?? setInternalActiveId;

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeSourceId) ?? sources[0],
    [activeSourceId, sources],
  );

  const interactive =
    draggable && Boolean(buildDragExpression) && activeSource != null;

  const displayItems = useMemo(
    () => (activeSource ? itemsForDebugDisplay(activeSource.items) : []),
    [activeSource],
  );

  return (
    <div className="data-inspector">
      <div className="data-inspector-body">
        {activeSource && interactive && buildDragExpression ? (
          <div className="input-items-json-preview">
            <JsonInteractiveView
              value={displayItems.length === 1 ? displayItems[0] : displayItems}
              itemCount={activeSource.items.length}
              source={activeSource}
              draggable={draggable}
              buildDragExpression={buildDragExpression}
            />
          </div>
        ) : activeSource ? (
          <JsonView
            items={activeSource.items}
            searchQuery={searchQuery}
            heightMode={jsonHeightMode}
          />
        ) : null}
      </div>
    </div>
  );
}
