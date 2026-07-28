import { describe, expect, it } from 'vitest';
import { collectCrewMembers } from './crew-members.js';
import type { WorkflowDefinition } from './validate.js';

const def: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'crew',
  nodes: [
    { id: 'crew', type: 'crewSequential', name: 'Crew', position: { x: 200, y: 0 }, parameters: {} },
    { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 300, y: 0 }, parameters: {} },
    { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 100, y: 0 }, parameters: {} },
  ],
  connections: [
    { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'a2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
  ],
};

describe('collectCrewMembers', () => {
  it('sorts members by canvas x position', () => {
    const members = collectCrewMembers(def, 'crew');
    expect(members.map((m) => m.id)).toEqual(['a1', 'a2']);
  });
});
