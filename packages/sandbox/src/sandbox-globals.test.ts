import { describe, expect, it } from 'vitest';
import { buildCodeSandboxGlobals } from './sandbox-globals.js';

describe('buildCodeSandboxGlobals', () => {
  it('aligns with expression globals for input and nodes', () => {
    const globals = buildCodeSandboxGlobals({
      inputItems: [{ json: { id: 1 } }, { json: { id: 2 } }],
      env: {},
      vars: {},
      nodes: [
        {
          name: 'HTTP',
          json: { status: 200 },
          items: [{ json: { status: 200 } }],
        },
      ],
      execution: { id: 'exec-1', mode: 'manual', environment: 'test' },
      workflow: { id: 'wf-1', name: 'Demo' },
    });
    expect(globals.$json).toEqual({ id: 1 });
    expect(globals.$input.all()).toHaveLength(2);
    expect(globals.$nodes.HTTP?.json).toEqual({ status: 200 });
    expect(globals.$execution?.id).toBe('exec-1');
    expect(globals.$workflow?.name).toBe('Demo');
  });
});
