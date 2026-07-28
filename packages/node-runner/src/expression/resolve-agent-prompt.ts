import type { WorkflowItem } from '@rxwf/shared';
import {
  type ItemTemplateScope,
  resolveInputItemTemplateString,
} from './item-context.js';

function buildUserMessage(
  prompt: string,
  inputItems: WorkflowItem[],
  itemIndex = 0,
): string {
  if (prompt.trim()) return prompt;
  const item = inputItems[itemIndex] ?? inputItems[0];
  if (!item) return 'Execute the task.';
  return JSON.stringify(item.json);
}

/** Read prompt / legacy text before template resolution. */
export function resolveAgentPromptRaw(agentParams: Record<string, unknown>): string {
  const prompt = String(agentParams.prompt ?? '').trim();
  if (prompt) return String(agentParams.prompt ?? '');
  const promptType = String(agentParams.promptType ?? 'auto');
  if (promptType === 'define') {
    return String(agentParams.text ?? '');
  }
  return '';
}

export async function resolveAgentUserMessage(
  rawParams: Record<string, unknown>,
  scope: ItemTemplateScope,
  itemIndex = 0,
): Promise<string> {
  const promptRaw = resolveAgentPromptRaw(rawParams);
  if (!promptRaw.trim()) {
    return buildUserMessage('', scope.inputItems, itemIndex);
  }
  const resolved = await resolveInputItemTemplateString(promptRaw, scope, itemIndex);
  return buildUserMessage(resolved, scope.inputItems, itemIndex);
}

export async function resolveAgentSystemMessage(
  rawParams: Record<string, unknown>,
  scope: ItemTemplateScope,
  itemIndex = 0,
): Promise<string> {
  const raw = String(rawParams.systemPrompt ?? rawParams.systemMessage ?? '');
  if (!raw.trim()) return '';
  return resolveInputItemTemplateString(raw, scope, itemIndex);
}
