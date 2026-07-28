import { describe, expect, it } from 'vitest';
import type { SkillIR } from './skill-ir.js';

describe('SkillIR', () => {
  it('accepts minimal shape', () => {
    const ir: SkillIR = {
      id: 'rxwf/code-review',
      name: 'code-review',
      description: 'Review code',
      skillRelPath: 'code-review',
      packageDir: '/repo/.rxwf/skills/code-review',
      permissions: ['filesystem:read'],
      provenance: 'rxwf',
    };
    expect(ir.skillRelPath).toBe('code-review');
  });
});
