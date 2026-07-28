import type { WorkflowItem } from '../editor-debug-types.js';
import type { JsonDataViewerHeightMode } from '../JsonDataViewer.js';

export interface DataInspectorSource {
  id: string;
  label: string;
  items: WorkflowItem[];
  icon?: 'node' | 'branch' | 'context';
  /** Pre-built schema children for context variables (legacy; JSON uses `items`) */
  contextChildren?: SchemaDisplayNode[];
}

export interface DataInspectorProps {
  sources: DataInspectorSource[];
  activeSourceId?: string;
  onActiveSourceChange?: (id: string) => void;
  searchQuery?: string;
  jsonHeightMode?: JsonDataViewerHeightMode;
  /** When true with `buildDragExpression`, JSON keys are draggable into param fields. */
  draggable?: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
}

export interface SchemaDisplayNode {
  id: string;
  key: string;
  path: string[];
  type: string;
  preview?: string;
  draggable?: boolean;
  expression?: string;
  children?: SchemaDisplayNode[];
}
