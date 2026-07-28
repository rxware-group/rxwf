import { describe, expect, it } from 'vitest';
import { isValidWorkflowConnection } from './connection-rules.js';
import { resolveConnectionFromOutput } from './node-port-defs.js';
import type { WorkflowDefinition } from '../../api/client.js';

const base: WorkflowDefinition = {
  schemaVersion: 1,
  name: 't',
  nodes: [
    { id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'm', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
    { id: 't', type: 'toolMcp', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
    { id: 's', type: 'set', name: 'S', position: { x: 0, y: 0 }, parameters: {} },
  ],
  connections: [],
};

describe('isValidWorkflowConnection', () => {
  it('allows matching ai_languageModel resource connection', () => {
    expect(
      isValidWorkflowConnection(base, {
        source: 'm',
        target: 'a',
        sourceHandle: 'ai_languageModel',
        targetHandle: 'ai_languageModel',
      }),
    ).toBe(true);
  });

  it('rejects mismatched resource port types', () => {
    expect(
      isValidWorkflowConnection(base, {
        source: 'm',
        target: 'a',
        sourceHandle: 'ai_languageModel',
        targetHandle: 'ai_tool',
      }),
    ).toBe(false);
  });

  it('resolveConnectionFromOutput fixes legacy chat model edges missing fromOutput', () => {
    expect(
      resolveConnectionFromOutput('aiChatModel', undefined, 'ai_languageModel'),
    ).toBe('ai_languageModel');
    expect(resolveConnectionFromOutput('set', undefined, 'main')).toBe('main');
  });

  it('allows main to main between data nodes', () => {
    expect(
      isValidWorkflowConnection(
        { ...base, nodes: [...base.nodes.filter((n) => n.id === 's'), { id: 's2', type: 'set', name: 'S2', position: { x: 0, y: 0 }, parameters: {} }] },
        { source: 's', target: 's2', sourceHandle: 'main', targetHandle: 'main' },
      ),
    ).toBe(true);
  });

  it('rejects crew resource connections when enableCrew is false', () => {
    const def: WorkflowDefinition = {
      ...base,
      settings: { enableCrew: false },
      nodes: [
        ...base.nodes,
        {
          id: 'c',
          type: 'crewSequential',
          name: 'C',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
    };
    expect(
      isValidWorkflowConnection(def, {
        source: 'a',
        target: 'c',
        sourceHandle: 'crew_member',
        targetHandle: 'crew_member',
      }),
    ).toBe(false);
  });

  it('allows crew resource connections when enableCrew is true', () => {
    const def: WorkflowDefinition = {
      ...base,
      settings: { enableCrew: true },
      nodes: [
        ...base.nodes,
        {
          id: 'c',
          type: 'crewSequential',
          name: 'C',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
    };
    expect(
      isValidWorkflowConnection(def, {
        source: 'a',
        target: 'c',
        sourceHandle: 'crew_member',
        targetHandle: 'crew_member',
      }),
    ).toBe(true);
  });
});
