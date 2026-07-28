import { describe, expect, it } from 'vitest';
import { collectGroupMembers, collectGroupOrchestrator } from './group-members.js';
import type { WorkflowDefinition } from './validate.js';

const def: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'gc',
  nodes: [
    { id: 'gc', type: 'groupChat', name: 'Chat', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: {} },
    { id: 'orch', type: 'aiAgent', name: 'Orch', position: { x: 50, y: 50 }, parameters: {} },
  ],
  connections: [
    { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
    { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
    { from: 'orch', to: 'gc', fromOutput: 'group_orchestrator', toInput: 'group_orchestrator' },
  ],
};

describe('collectGroupMembers', () => {
  it('returns aiAgent members sorted by x', () => {
    const m = collectGroupMembers(def, 'gc');
    expect(m.map((n) => n.id)).toEqual(['a1', 'a2']);
  });
});

describe('collectGroupOrchestrator', () => {
  it('returns orchestrator aiAgent when connected', () => {
    expect(collectGroupOrchestrator(def, 'gc')?.id).toBe('orch');
  });
});
