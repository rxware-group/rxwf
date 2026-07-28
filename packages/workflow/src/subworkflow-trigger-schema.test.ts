import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from './validate.js';
import {
  fieldsToJsonSchema,
  inferFieldsFromJsonExample,
  resolveSubworkflowInputSchema,
  validateSubworkflowTriggerLayout,
} from './subworkflow-trigger-schema.js';

function def(nodes: WorkflowDefinition['nodes'], settings?: WorkflowDefinition['settings']) {
  return {
    schemaVersion: 1 as const,
    name: 'test',
    nodes,
    connections: [],
    settings,
  };
}

describe('inferFieldsFromJsonExample', () => {
  it('infers primitive types from object', () => {
    const fields = inferFieldsFromJsonExample({ query: 'hi', limit: 3, ok: true, meta: {} });
    expect(fields).toEqual([
      { name: 'query', type: 'string', required: false },
      { name: 'limit', type: 'number', required: false },
      { name: 'ok', type: 'boolean', required: false },
      { name: 'meta', type: 'json', required: false },
    ]);
  });

  it('returns null for non-object', () => {
    expect(inferFieldsFromJsonExample([])).toBeNull();
  });
});

describe('resolveSubworkflowInputSchema', () => {
  it('resolves fields mode with required defaults', () => {
    const schema = resolveSubworkflowInputSchema(
      def([
        {
          id: 'st',
          type: 'subworkflowTrigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: {
            inputMode: 'fields',
            inputs: [{ name: 'query', type: 'string', description: 'Search' }],
          },
        },
      ]),
    );
    expect(schema?.mode).toBe('fields');
    expect(schema?.jsonSchema).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string', description: 'Search' } },
    });
  });

  it('resolves acceptAll mode', () => {
    const schema = resolveSubworkflowInputSchema(
      def([
        {
          id: 'st',
          type: 'subworkflowTrigger',
          name: 'Start',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll' },
        },
      ]),
    );
    expect(schema?.mode).toBe('acceptAll');
    expect(schema?.jsonSchema).toMatchObject({ additionalProperties: true });
  });
});

describe('validateSubworkflowTriggerLayout', () => {
  it('E1052 when exposeAsTool without subworkflowTrigger', () => {
    const issues = validateSubworkflowTriggerLayout(
      def(
        [
          {
            id: 'm',
            type: 'manualTrigger',
            name: 'Manual',
            position: { x: 0, y: 0 },
            parameters: {},
          },
        ],
        { exposeAsTool: true },
      ),
    );
    expect(issues.some((i) => i.code === 'E1052')).toBe(true);
  });

  it('E1051 when subworkflowTrigger coexists with manualTrigger', () => {
    const issues = validateSubworkflowTriggerLayout(
      def([
        {
          id: 'st',
          type: 'subworkflowTrigger',
          name: 'Sub',
          position: { x: 0, y: 0 },
          parameters: { inputMode: 'acceptAll' },
        },
        {
          id: 'm',
          type: 'manualTrigger',
          name: 'Manual',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ]),
    );
    expect(issues.some((i) => i.code === 'E1051')).toBe(true);
  });
});

describe('fieldsToJsonSchema', () => {
  it('omits required array when all optional', () => {
    const schema = fieldsToJsonSchema([
      { name: 'q', type: 'string', required: false },
    ]);
    expect(schema.required).toBeUndefined();
  });
});
