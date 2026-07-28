import { itemsForDebugDisplay } from '../editor-debug-types.js';
import {
  formatJsonData,
  JsonDataViewer,
  type JsonDataViewerHeightMode,
} from '../JsonDataViewer.js';
import type { WorkflowItem } from '../editor-debug-types.js';

export function JsonView({
  items,
  searchQuery = '',
  heightMode = 'content',
}: {
  items: WorkflowItem[];
  searchQuery?: string;
  heightMode?: JsonDataViewerHeightMode;
}) {
  const display = itemsForDebugDisplay(items);

  return (
    <div className="input-items-json-preview">
      <JsonDataViewer
        value={formatJsonData(display)}
        searchQuery={searchQuery}
        heightMode={heightMode}
      />
    </div>
  );
}
