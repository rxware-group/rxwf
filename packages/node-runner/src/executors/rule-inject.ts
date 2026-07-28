import { collectContextPaths, resolveRules, type RuleResolveInput } from '@rxwf/skill-runtime';
import type { WorkflowItem } from '@rxwf/shared';

export async function buildRuleSystemAppendix(
  input: RuleResolveInput & {
    inputItems?: WorkflowItem[];
    nodeParams?: Record<string, unknown>;
  },
): Promise<string> {
  const contextPaths =
    input.contextPaths ??
    (input.inputItems && input.nodeParams
      ? collectContextPaths(input.inputItems, input.nodeParams)
      : undefined);
  const { merged } = await resolveRules({ ...input, contextPaths });
  if (!merged.trim()) return '';
  return `\n\n## Project rules\n\n${merged}`;
}
