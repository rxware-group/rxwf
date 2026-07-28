import { describe, expect, it } from 'vitest';
import type { ValidationError, WorkflowDefinition } from './validate.js';
import { validateSwitchNodes } from './validate-switch.js';

function switchWorkflow(
  branches: Array<{ id: string; label: string; condition: string }>,
  connections: WorkflowDefinition['connections'] = [],
): WorkflowDefinition {
  return {
    schemaVersion: 1,
    name: 'switch-test',
    nodes: [
      {
        id: 't1',
        type: 'manualTrigger',
        name: 'Start',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'sw1',
        type: 'switch',
        name: 'Switch',
        position: { x: 1, y: 0 },
        parameters: { branches },
      },
      {
        id: 'set1',
        type: 'set',
        name: 'Set',
        position: { x: 2, y: 0 },
        parameters: {},
      },
    ],
    connections: [{ from: 't1', to: 'sw1' }, ...connections],
  };
}

describe('validateSwitchNodes', () => {
  it('rejects switch when a branch condition expression is empty', () => {
    const errors: ValidationError[] = [];
    validateSwitchNodes(
      switchWorkflow([
        { id: 'a', label: 'A', condition: '{{ true }}' },
        { id: 'b', label: 'B', condition: '' },
      ]),
      errors,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.nodeId === 'sw1')).toBe(true);
  });

  it('rejects switch when an outgoing port does not match any branch rule', () => {
    const errors: ValidationError[] = [];
    validateSwitchNodes(
      switchWorkflow(
        [
          { id: 'a', label: 'A', condition: '{{ true }}' },
          { id: 'b', label: 'B', condition: '{{ false }}' },
        ],
        [{ from: 'sw1', to: 'set1', fromOutput: 'missing-port' }],
      ),
      errors,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.nodeId === 'sw1')).toBe(true);
  });

  it('accepts switch with valid branches and matching output ports', () => {
    const errors: ValidationError[] = [];
    validateSwitchNodes(
      switchWorkflow(
        [
          { id: 'a', label: 'A', condition: '{{ true }}' },
          { id: 'b', label: 'B', condition: '{{ false }}' },
        ],
        [{ from: 'sw1', to: 'set1', fromOutput: 'a' }],
      ),
      errors,
    );
    expect(errors).toEqual([]);
  });
});
