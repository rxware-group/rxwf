import { describe, it, expect } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { toWorkflowGraph } from './to-workflow-graph.js';

describe('toWorkflowGraph', () => {
  it('maps definition nodes and connections to engine graph', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'G',
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 's1',
          type: 'set',
          name: 'S',
          position: { x: 1, y: 0 },
          parameters: { a: 1 },
        },
      ],
      connections: [{ from: 't1', to: 's1' }],
    };
    const { graph, startNodeId } = toWorkflowGraph(definition);
    expect(startNodeId).toBe('t1');
    expect(graph.nodes).toEqual([
      { id: 't1', name: 'T', type: 'manualTrigger', config: {} },
      { id: 's1', name: 'S', type: 'set', config: { a: 1 } },
    ]);
    expect(graph.edges).toEqual([{ from: 't1', to: 's1', outputIndex: 0 }]);
  });

  it('excludes satellite-only nodes and ai_* edges from executable graph', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'agent',
      nodes: [
        {
          id: 'tr',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'agt',
          type: 'aiAgent',
          name: 'A',
          position: { x: 1, y: 0 },
          parameters: {},
        },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'M',
          position: { x: 0, y: 1 },
          parameters: { provider: 'ollama', model: 'llama3' },
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
      ],
    };
    const { graph } = toWorkflowGraph(definition);
    expect(graph.nodes.some((n) => n.id === 'mdl')).toBe(false);
    expect(graph.nodes.some((n) => n.id === 'agt')).toBe(true);
    expect(graph.edges).toEqual([{ from: 'tr', to: 'agt', outputIndex: 0 }]);
  });

  it('excludes crew_member, crew_manager, and ai satellite edges from executable graph', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'crew',
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'tr',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'crew',
          type: 'crewSequential',
          name: 'Crew',
          position: { x: 200, y: 0 },
          parameters: {},
        },
        {
          id: 'w1',
          type: 'aiAgent',
          name: 'W1',
          position: { x: 0, y: 100 },
          parameters: { role: 'A', goal: 'A' },
        },
        {
          id: 'w2',
          type: 'aiAgent',
          name: 'W2',
          position: { x: 100, y: 100 },
          parameters: { role: 'B', goal: 'B' },
        },
        {
          id: 'mdl-w1',
          type: 'aiChatModel',
          name: 'M1',
          position: { x: 0, y: 200 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
        {
          id: 't-w1',
          type: 'toolHttp',
          name: 'Tool1',
          position: { x: 0, y: 280 },
          parameters: {
            method: 'GET',
            url: 'https://example.com',
            toolDescription: 'tool',
          },
        },
      ],
      connections: [
        { from: 'tr', to: 'crew' },
        { from: 'w1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
        { from: 'w2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
        {
          from: 'mdl-w1',
          to: 'w1',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
        { from: 't-w1', to: 'w1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
      ],
    };
    const { graph, startNodeId } = toWorkflowGraph(definition);
    expect(startNodeId).toBe('tr');
    expect(graph.edges).toEqual([{ from: 'tr', to: 'crew', outputIndex: 0 }]);
    expect(graph.nodes.some((n) => n.id === 'mdl-w1')).toBe(false);
    expect(graph.nodes.some((n) => n.id === 'crew')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'w1')).toBe(true);
  });

  it('excludes group_member and group_orchestrator edges from executable graph', () => {
    const definition: WorkflowDefinition = {
      schemaVersion: 1,
      name: 'group-chat',
      settings: { workflowKind: 'agent' },
      nodes: [
        {
          id: 'tr',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
        {
          id: 'gc',
          type: 'groupChat',
          name: 'Chat',
          position: { x: 200, y: 0 },
          parameters: {},
        },
        {
          id: 'a1',
          type: 'aiAgent',
          name: 'A',
          position: { x: 0, y: 100 },
          parameters: { role: 'A' },
        },
        {
          id: 'a2',
          type: 'aiAgent',
          name: 'B',
          position: { x: 100, y: 100 },
          parameters: { role: 'B' },
        },
        {
          id: 'mdl',
          type: 'aiChatModel',
          name: 'M',
          position: { x: 0, y: 200 },
          parameters: { provider: 'ollama', model: 'llama3' },
        },
      ],
      connections: [
        { from: 'tr', to: 'gc' },
        { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
        {
          from: 'mdl',
          to: 'a1',
          fromOutput: 'ai_languageModel',
          toInput: 'ai_languageModel',
        },
      ],
    };
    const { graph, startNodeId } = toWorkflowGraph(definition);
    expect(startNodeId).toBe('tr');
    expect(graph.edges).toEqual([{ from: 'tr', to: 'gc', outputIndex: 0 }]);
    expect(graph.nodes.some((n) => n.id === 'mdl')).toBe(false);
    expect(graph.nodes.some((n) => n.id === 'gc')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'a1')).toBe(true);
  });
});
