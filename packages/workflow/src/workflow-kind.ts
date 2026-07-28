import type { WorkflowDefinition } from './validate.js';

export type WorkflowKind = 'automation' | 'agent';

export function getWorkflowKind(definition: WorkflowDefinition): WorkflowKind {
  const k = definition.settings?.workflowKind;
  return k === 'agent' ? 'agent' : 'automation';
}

export function defaultAgentWorkflowDefinition(name = 'New Agent'): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name,
    settings: { workflowKind: 'agent' },
    nodes: [
      {
        id: 'tr',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 80, y: 120 },
        parameters: {},
      },
      {
        id: 'agt',
        type: 'aiAgent',
        name: 'Agent',
        position: { x: 320, y: 120 },
        parameters: { sessionId: '', maxIterations: 10 },
      },
      {
        id: 'mdl',
        type: 'aiChatModel',
        name: 'Model',
        position: { x: 320, y: 260 },
        parameters: { provider: 'ollama', model: 'llama3' },
      },
      {
        id: 'mem',
        type: 'aiMemory',
        name: 'Memory',
        position: { x: 80, y: 260 },
        parameters: { maxTurns: 20 },
      },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      {
        from: 'mdl',
        to: 'agt',
        fromOutput: 'ai_languageModel',
        toInput: 'ai_languageModel',
      },
      {
        from: 'mem',
        to: 'agt',
        fromOutput: 'ai_memory',
        toInput: 'ai_memory',
      },
    ],
  };
}
