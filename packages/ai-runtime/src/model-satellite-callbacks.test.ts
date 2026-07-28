import { describe, expect, it, vi } from 'vitest';
import { createModelSatelliteCallbacks } from './model-satellite-callbacks.js';

describe('createModelSatelliteCallbacks', () => {
  it('flushPendingInvocations emits end for unmatched start', async () => {
    const emit = vi.fn();
    const { handlers, flushPendingInvocations } = createModelSatelliteCallbacks({
      modelNodeId: 'model-1',
      onSatelliteStream: emit,
    });
    const handler = handlers[0]!;
    await handler.handleChatModelStart?.({} as never, [[]], 'run-1');
    expect(emit).toHaveBeenCalledWith('model-1', {
      type: 'satellite_invoke_start',
      input: [],
    });
    flushPendingInvocations();
    expect(emit).toHaveBeenCalledWith(
      'model-1',
      expect.objectContaining({ type: 'satellite_invoke_end' }),
    );
  });

  it('uses initialPromptMessages on first LLM round', async () => {
    const emit = vi.fn();
    const { handlers } = createModelSatelliteCallbacks(
      {
        modelNodeId: 'model-1',
        onSatelliteStream: emit,
      },
      {
        initialPromptMessages: [
          { role: 'user', content: 'q' },
          { role: 'assistant', content: 'a' },
          { role: 'user', content: 'latest' },
        ],
      },
    );
    const handler = handlers[0]!;
    await handler.handleChatModelStart?.({} as never, [[{ role: 'human' } as never]], 'run-1');
    const input = emit.mock.calls[0]?.[1]?.input as Array<{ role: string }>;
    expect(input.map((row) => row.role)).toEqual(['user', 'assistant', 'user']);
  });
});
