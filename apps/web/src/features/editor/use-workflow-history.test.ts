import { describe, it, expect } from 'vitest';
import type { WorkflowDefinition } from '../../api/client.js';

const base = (): WorkflowDefinition => ({
  schemaVersion: 1,
  name: 'Test',
  nodes: [{ id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} }],
  connections: [],
});

// 与 hook 内 reducer 逻辑一致的最小复现
function commit(
  state: { past: WorkflowDefinition[]; present: WorkflowDefinition; future: WorkflowDefinition[] },
  next: WorkflowDefinition,
) {
  return {
    past: [...state.past, structuredClone(state.present)],
    present: next,
    future: [],
  };
}

describe('workflow history', () => {
  it('undo restores previous definition', () => {
    const s0 = base();
    const s1 = { ...s0, name: 'Changed' };
    let state = { past: [] as WorkflowDefinition[], present: s0, future: [] as WorkflowDefinition[] };
    state = commit(state, s1);
    expect(state.present.name).toBe('Changed');
    const prev = state.past[state.past.length - 1]!;
    state = {
      past: state.past.slice(0, -1),
      present: prev,
      future: [structuredClone(state.present)],
    };
    expect(state.present.name).toBe('Test');
  });
});
