import type { NodeDebugState } from './editor-debug-types.js';

export type AgentMemoryMessagePreview = {
  role: string;
  content: string;
  createdAt?: string;
};

export type AgentMemorySnapshotPreview = {
  sessionId: string;
  messages: AgentMemoryMessagePreview[];
};

/** Session id is a fixed literal (not an expression template). */
export function isStaticAgentSessionId(raw: unknown): boolean {
  const sessionId = String(raw ?? '').trim();
  if (!sessionId) return false;
  return !sessionId.includes('{{');
}

export function resolveMemorySnapshotFromDebug(
  debug?: NodeDebugState,
): AgentMemorySnapshotPreview | null {
  if (!debug) return null;
  const fromItems = debug.outputItems?.[0]?.[0]?.json;
  if (fromItems && typeof fromItems === 'object' && !Array.isArray(fromItems)) {
    const sessionId = String((fromItems as { sessionId?: unknown }).sessionId ?? '').trim();
    const messages = (fromItems as { messages?: unknown }).messages;
    if (sessionId && Array.isArray(messages)) {
      return { sessionId, messages: messages as AgentMemoryMessagePreview[] };
    }
  }
  for (let i = (debug.agentStream?.length ?? 0) - 1; i >= 0; i--) {
    const entry = debug.agentStream?.[i];
    if (entry?.type !== 'satellite_memory_snapshot') continue;
    const sessionId = String(entry.sessionId ?? '').trim();
    if (!sessionId || !Array.isArray(entry.messages)) continue;
    return { sessionId, messages: entry.messages as AgentMemoryMessagePreview[] };
  }
  return null;
}
