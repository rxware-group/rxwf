import { describe, it, expect } from 'vitest';
import { createExecutionSnapshot } from './create-execution-snapshot.js';

describe('createExecutionSnapshot', () => {
  it('freezes workflow definition at enqueue time', () => {
    const snap = createExecutionSnapshot({
      workflowId: 'wf-1',
      workflowVersionId: 'v-3',
      definition: { nodes: [{ id: 'n1', type: 'set' }], edges: [] },
      triggerType: 'manual',
    });
    expect(snap.workflowVersionId).toBe('v-3');
    expect(snap.definition_snapshot.nodes).toHaveLength(1);
    expect(snap.trigger_type).toBe('manual');
  });
});
