import type { WorkflowDefinition } from '../../api/client.js';

export function emptyWorkflowDefinition(name: string): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Start',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  };
}
