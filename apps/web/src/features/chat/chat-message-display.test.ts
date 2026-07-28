import { describe, expect, it } from 'vitest';
import { chatMessageRoleLabel, formatChatMessageTime } from './chat-message-display.js';

describe('chat-message-display', () => {
  it('formats role labels like agent memory', () => {
    const labels = {
      'agentMemory.session.roleUser': '用户',
      'agentMemory.session.roleAssistant': '助手',
    };
    expect(chatMessageRoleLabel(labels, 'user')).toBe('用户');
    expect(chatMessageRoleLabel(labels, 'assistant')).toBe('助手');
  });

  it('formats message timestamps', () => {
    expect(formatChatMessageTime('not-a-date')).toBe('—');
    expect(formatChatMessageTime('2026-01-15T08:00:00.000Z')).toContain('2026');
  });
});
