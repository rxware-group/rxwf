import {

  FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS,

  FIXED_CAPABILITY_TOOL_TYPES,

} from '@rxwf/i18n-catalog';



/** Keep in sync with @rxwf/node-runner FIXED_CAPABILITY_TOOL_TYPES. */

export { FIXED_CAPABILITY_TOOL_TYPES, FIXED_CAPABILITY_TOOL_AGENT_DESC_KEYS };



export function isFixedCapabilityToolType(type: string): boolean {

  return FIXED_CAPABILITY_TOOL_TYPES.has(type);

}



/** i18n keys for user-facing summary (catalog-ui editor.agentTools.*Hint). */

export const FIXED_CAPABILITY_TOOL_HINT_KEYS: Record<string, string> = {

  toolRead: 'editor.agentTools.toolReadHint',

  toolWrite: 'editor.agentTools.toolWriteHint',

  toolGrep: 'editor.agentTools.toolGrepHint',

  toolShell: 'editor.agentTools.toolShellHint',

  toolWebSearch: 'editor.agentTools.toolWebSearchHint',

};

