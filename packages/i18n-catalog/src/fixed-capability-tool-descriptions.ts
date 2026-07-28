import { getLocaleBundle, normalizeLocaleCode } from './catalog.js';

/** i18n keys for LLM-facing descriptions of fixed-capability tool satellites. */
export const FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS: Record<string, string> = {
  toolRead: 'editor.agentTools.toolReadAgentDesc',
  toolWrite: 'editor.agentTools.toolWriteAgentDesc',
  toolGrep: 'editor.agentTools.toolGrepAgentDesc',
  toolShell: 'editor.agentTools.toolShellAgentDesc',
  toolWebSearch: 'editor.agentTools.toolWebSearchAgentDesc',
};

export const FIXED_CAPABILITY_TOOL_TYPES = new Set(Object.keys(FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS));

export function resolveFixedCapabilityToolAgentDescription(
  nodeType: string,
  parameters: Record<string, unknown>,
  locale?: string,
): string {
  const custom = String(parameters.toolDescription ?? '').trim();
  if (custom) return custom;

  const key = FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS[nodeType];
  if (!key) return '';

  const bundle = getLocaleBundle(normalizeLocaleCode(locale ?? 'zh-CN'));
  return bundle[key] ?? '';
}
