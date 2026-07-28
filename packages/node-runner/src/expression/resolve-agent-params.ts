import type { WorkflowDefinition } from '@rxwf/workflow';
import type { WorkflowItem } from '@rxwf/shared';
import {
  type ItemTemplateScope,
  resolveInputItemTemplateString,
} from './item-context.js';

/** String parameters on aiAgent that may contain {{ }} templates. */
export const AI_AGENT_TEMPLATE_PARAM_KEYS = [
  'role',
  'goal',
  'backstory',
  'taskDescription',
  'expectedOutput',
  'prompt',
  'systemPrompt',
  'systemMessage',
  'text',
  'sessionId',
] as const;

export async function resolveAgentParameters(
  params: Record<string, unknown>,
  scope: ItemTemplateScope,
  inputItems: WorkflowItem[] = scope.inputItems,
  itemIndex = 0,
): Promise<Record<string, unknown>> {
  const out = { ...params };
  const resolveScope = { ...scope, inputItems };
  for (const key of AI_AGENT_TEMPLATE_PARAM_KEYS) {
    const raw = params[key];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    out[key] = await resolveInputItemTemplateString(raw, resolveScope, itemIndex);
  }
  return out;
}

export async function resolveCrewWorkflowDefinition(
  definition: WorkflowDefinition,
  scope: ItemTemplateScope,
  nodeIds: Iterable<string>,
): Promise<WorkflowDefinition> {
  const idSet = new Set(nodeIds);
  const nodes = await Promise.all(
    definition.nodes.map(async (node) => {
      if (!idSet.has(node.id) || node.type !== 'aiAgent') return node;
      return {
        ...node,
        parameters: await resolveAgentParameters(node.parameters, scope),
      };
    }),
  );
  return { ...definition, nodes };
}
