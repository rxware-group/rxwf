import type { WorkflowDefinition } from '../../api/client.js';
import type { NodeDebugState, NodeOutputPreview } from './editor-debug-types.js';

export function parseOutputParserSchema(
  parameters?: Record<string, unknown>,
): Record<string, unknown> | unknown[] | null {
  const raw = parameters?.jsonSchema;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown> | unknown[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveSchemaFromOutputParserDebug(
  debug?: NodeDebugState,
): unknown | null {
  for (let i = (debug?.agentStream?.length ?? 0) - 1; i >= 0; i -= 1) {
    const entry = debug?.agentStream?.[i];
    if (entry?.type === 'satellite_schema_read' && entry.schema !== undefined) {
      return entry.schema;
    }
  }
  const fromItems = debug?.outputItems?.[0]?.[0]?.json?.schema;
  if (fromItems !== undefined) return fromItems;
  return null;
}

export function resolveOutputParserSchemaPreview(
  node: WorkflowDefinition['nodes'][number],
  debug?: NodeDebugState,
): NodeOutputPreview | null {
  const schema =
    resolveSchemaFromOutputParserDebug(debug) ?? parseOutputParserSchema(node.parameters);
  if (schema === null) return null;
  return { kind: 'single', data: [schema] };
}
