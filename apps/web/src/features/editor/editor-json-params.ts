import type { WorkflowDefinition } from '../../api/client.js';
import { t, type LabelMap } from '../../i18n/labels.js';
import { resolveLabel } from '../../i18n/resolve-label.js';
import { getParamSchema } from './node-param-schemas.js';

export function formatJsonParamValue(value: unknown): string {
  if (value === undefined) return '{}';
  return JSON.stringify(value, null, 2);
}

/** Apply in-progress JSON textarea text onto a workflow definition (sync, for execute/save). */
export function applyJsonDraftsToDefinition(
  labels: LabelMap,
  definition: WorkflowDefinition,
  nodeId: string,
  drafts: Record<string, string>,
): { definition: WorkflowDefinition; error?: string } {
  const node = definition.nodes.find((n) => n.id === nodeId);
  if (!node) return { definition };

  const params = { ...node.parameters };
  for (const field of getParamSchema(node.type)) {
    if (field.type !== 'json') continue;
    const text = drafts[field.key];
    if (text === undefined) continue;
    const trimmed = text.trim();
    if (!trimmed) {
      params[field.key] = {};
      continue;
    }
    try {
      params[field.key] = JSON.parse(trimmed) as unknown;
    } catch {
      return {
        definition,
        error: t(labels, 'editor.jsonInvalid', {
          label: resolveLabel(labels, field.label),
        }),
      };
    }
  }

  return {
    definition: {
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === nodeId ? { ...n, parameters: params } : n,
      ),
    },
  };
}

/** Merge saved parameters with in-editor JSON textarea overrides. */
export function resolveJsonDraftsForNode(
  node: WorkflowDefinition['nodes'][number],
  overrides: Record<string, string> = {},
): Record<string, string> {
  return { ...initJsonDraftsForNode(node), ...overrides };
}

export function initJsonDraftsForNode(
  node: WorkflowDefinition['nodes'][number],
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const field of getParamSchema(node.type)) {
    if (field.type === 'json') {
      drafts[field.key] = formatJsonParamValue(node.parameters[field.key]);
    }
  }
  return drafts;
}

/** Merge in-editor JSON textarea overrides for all nodes onto a workflow definition. */
export function applyAllJsonDraftsToDefinition(
  labels: LabelMap,
  definition: WorkflowDefinition,
  draftsByNode: Record<string, Record<string, string>>,
): { definition: WorkflowDefinition; error?: string } {
  let result = definition;
  for (const [nodeId, overrides] of Object.entries(draftsByNode)) {
    const node = result.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const drafts = resolveJsonDraftsForNode(node, overrides);
    const applied = applyJsonDraftsToDefinition(labels, result, nodeId, drafts);
    if (applied.error) return applied;
    result = applied.definition;
  }
  return { definition: result };
}
