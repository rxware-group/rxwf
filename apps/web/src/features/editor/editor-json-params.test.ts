import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../../api/client.js';
import { applyAllJsonDraftsToDefinition } from './editor-json-params.js';

const labels = {} as Record<string, string>;

function manualTriggerDef(json: unknown): WorkflowDefinition {
  return {
    name: 'test',
    nodes: [
      {
        id: 'n1',
        type: 'manualTrigger',
        name: 'Manual',
        position: { x: 0, y: 0 },
        parameters: { json },
      },
    ],
    connections: [],
    settings: {},
  };
}

describe('applyAllJsonDraftsToDefinition', () => {
  it('merges manual trigger json draft into definition', () => {
    const base = manualTriggerDef({});
    const { definition } = applyAllJsonDraftsToDefinition(labels, base, {
      n1: { json: '{\n  "foo": "bar"\n}' },
    });
    expect(definition.nodes[0]?.parameters.json).toEqual({ foo: 'bar' });
  });

  it('returns error for invalid json without mutating definition', () => {
    const base = manualTriggerDef({ kept: true });
    const result = applyAllJsonDraftsToDefinition(labels, base, {
      n1: { json: '{ invalid' },
    });
    expect(result.error).toBeTruthy();
    expect(result.definition.nodes[0]?.parameters.json).toEqual({ kept: true });
  });
});
