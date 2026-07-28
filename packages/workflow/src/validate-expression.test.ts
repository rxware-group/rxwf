import { describe, it, expect } from 'vitest';
import { validateWorkflowDefinition } from './validate.js';

describe('validateWorkflowDefinition expression sources', () => {
  it('rejects expressions with process', () => {
    const result = validateWorkflowDefinition({
      schemaVersion: 1,
      name: 't',
      nodes: [
        {
          id: 'n1',
          type: 'if',
          name: 'IF',
          position: { x: 0, y: 0 },
          parameters: {
            condition: '{{ process.exit() }}',
            _fieldModes: { condition: 'expression' },
          },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E1002')).toBe(true);
    }
  });
});
