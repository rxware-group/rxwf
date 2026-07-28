import { describe, expect, it } from 'vitest';
import { compileCrewFlowGraph } from './compile-crew-flow.js';
import type { AwfCrewMemberIr } from './crew-ir.js';

function member(nodeId: string, name: string): AwfCrewMemberIr {
  return {
    nodeId,
    name,
    model: { provider: 'ollama', model: 'llama3' },
    tools: [],
  };
}

describe('compileCrewFlowGraph', () => {
  it('builds linear start → tasks → end graph', () => {
    const graph = compileCrewFlowGraph([member('a1', 'Writer'), member('a2', 'Editor')]);

    expect(graph.entryNodeId).toBe('flow_start');
    expect(graph.nodes.map((n) => n.type)).toEqual(['start', 'task', 'task', 'end']);
    expect(graph.edges).toEqual([
      { from: 'flow_start', to: 'flow_task_a1' },
      { from: 'flow_task_a1', to: 'flow_task_a2' },
      { from: 'flow_task_a2', to: 'flow_end' },
    ]);
  });

  it('inserts router after specified member with conditional branches', () => {
    const graph = compileCrewFlowGraph([member('a1', 'Researcher'), member('a2', 'Writer'), member('a3', 'Editor')], {
      afterMemberNodeId: 'a1',
      defaultMemberNodeId: 'a2',
      branches: [
        { condition: 'contains:review', memberNodeId: 'a3', label: 'review' },
        { condition: 'contains:write', memberNodeId: 'a2', label: 'write' },
      ],
    });

    const router = graph.nodes.find((n) => n.type === 'router');
    expect(router?.router?.branches).toHaveLength(2);
    expect(router?.router?.defaultNext).toBe('flow_task_a2');
    expect(graph.nodes.filter((n) => n.type === 'task')).toHaveLength(3);
    expect(graph.edges.some((e) => e.from === 'flow_task_a1' && e.to === 'flow_router_1')).toBe(true);
  });
});
