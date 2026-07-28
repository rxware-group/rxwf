import {
  FIXED_CAPABILITY_TOOL_TYPES,
  resolveFixedCapabilityToolAgentDescription,
} from '@rxwf/i18n-catalog';

export { FIXED_CAPABILITY_TOOL_TYPES };

export function resolveSatelliteToolDescription(
  nodeType: string,
  parameters: Record<string, unknown>,
  locale?: string,
): string {
  if (FIXED_CAPABILITY_TOOL_TYPES.has(nodeType)) {
    return resolveFixedCapabilityToolAgentDescription(nodeType, parameters, locale);
  }
  return String(parameters.toolDescription ?? '').trim();
}
