import { describe, expect, it } from 'vitest';
import { formatAgentMemoryMessageContent } from './agent-memory-message-format.js';

describe('formatAgentMemoryMessageContent', () => {
  it('extracts answer field from assistant JSON content', () => {
    expect(
      formatAgentMemoryMessageContent(
        JSON.stringify({ answer: 'Hello from agent' }),
        'assistant',
      ),
    ).toBe('Hello from agent');
  });

  it('keeps user content unchanged', () => {
    expect(formatAgentMemoryMessageContent('你是谁？', 'user')).toBe('你是谁？');
  });

  it('keeps non-answer assistant JSON unchanged', () => {
    const raw = JSON.stringify({ tool: 'search', result: 'ok' });
    expect(formatAgentMemoryMessageContent(raw, 'assistant')).toBe(raw);
  });
});
