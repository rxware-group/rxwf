import { describe, expect, it } from 'vitest';
import type { ValidationError, WorkflowDefinition } from './validate.js';
import {
  defaultGroupChatParameters,
  normalizeGroupChatParameters,
  validateGroupChatNodes,
} from './validate-group-chat.js';

function groupChatNode(
  parameters: Record<string, unknown> = {},
  id = 'gc1',
): WorkflowDefinition['nodes'][number] {
  return {
    id,
    type: 'groupChat',
    name: 'Group Chat',
    position: { x: 0, y: 0 },
    parameters,
  };
}

describe('defaultGroupChatParameters', () => {
  it('sets userProxyTimeoutMs default to -1 (OQ-010: no timeout)', () => {
    expect(defaultGroupChatParameters().userProxyTimeoutMs).toBe(-1);
  });

  it('normalizeGroupChatParameters applies userProxyTimeoutMs -1 when omitted', () => {
    expect(normalizeGroupChatParameters({}).userProxyTimeoutMs).toBe(-1);
  });
});

describe('validateGroupChatNodes', () => {
  it('errors E1053 when userProxyTimeoutMs is less than -1', () => {
    const errors: ValidationError[] = [];
    validateGroupChatNodes(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [groupChatNode({ userProxyTimeoutMs: -2 })],
        connections: [],
      },
      errors,
    );
    expect(errors.some((e) => e.code === 'E1053')).toBe(true);
  });

  it('errors E1048 when groupChat has fewer than two members', () => {
    const errors: ValidationError[] = [];
    validateGroupChatNodes(
      {
        schemaVersion: 1,
        name: 't',
        nodes: [groupChatNode()],
        connections: [],
      },
      errors,
    );
    expect(errors.some((e) => e.code === 'E1048')).toBe(true);
  });
});
