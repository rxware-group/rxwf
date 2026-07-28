import { describe, expect, it } from 'vitest';
import {
  isStaticAgentSessionId,
  resolveMemorySnapshotFromDebug,
} from './memory-output.js';

describe('memory-output', () => {
  it('isStaticAgentSessionId rejects expression templates', () => {
    expect(isStaticAgentSessionId('my-session')).toBe(true);
    expect(isStaticAgentSessionId('{{ $json.id }}')).toBe(false);
    expect(isStaticAgentSessionId('')).toBe(false);
  });

  it('resolveMemorySnapshotFromDebug reads outputItems and agentStream', () => {
    const snapshot = {
      sessionId: 's1',
      messages: [{ role: 'assistant', content: 'ok' }],
    };
    expect(
      resolveMemorySnapshotFromDebug({
        status: 'success',
        outputItems: [[{ json: snapshot }]],
      }),
    ).toEqual(snapshot);
    expect(
      resolveMemorySnapshotFromDebug({
        status: 'success',
        agentStream: [{ type: 'satellite_memory_snapshot', ...snapshot }],
      }),
    ).toEqual(snapshot);
  });
});
