import { describe, expect, it } from 'vitest';
import { validateToolWorkflowTarget } from './tool-workflow-target.js';

describe('validateToolWorkflowTarget', () => {
  it('E1024 when published but exposeAsTool false', () => {
    const err = validateToolWorkflowTarget(
      { exists: true, published: true, exposeAsTool: false },
      'n1',
    );
    expect(err?.code).toBe('E1024');
  });

  it('null when target is valid', () => {
    expect(
      validateToolWorkflowTarget({
        exists: true,
        published: true,
        exposeAsTool: true,
      }),
    ).toBeNull();
  });
});
