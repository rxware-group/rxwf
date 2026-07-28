import { describe, expect, it } from 'vitest';
import { normalizeRxwfSkillPath } from './rxwf-path.js';

describe('normalizeRxwfSkillPath', () => {
  it('accepts bare skill name', () => {
    expect(normalizeRxwfSkillPath('sample-skill')).toEqual({
      skillRelPath: 'sample-skill',
      normalized: '.rxwf/skills/sample-skill',
    });
  });

  it('accepts nested rel path under skills', () => {
    expect(normalizeRxwfSkillPath('team/ops/foo')).toEqual({
      skillRelPath: 'team/ops/foo',
      normalized: '.rxwf/skills/team/ops/foo',
    });
  });

  it('accepts full .rxwf/skills path', () => {
    expect(normalizeRxwfSkillPath('.rxwf/skills/code-review')).toEqual({
      skillRelPath: 'code-review',
      normalized: '.rxwf/skills/code-review',
    });
  });

  it('accepts skills/ prefix', () => {
    expect(normalizeRxwfSkillPath('skills/hello')).toEqual({
      skillRelPath: 'hello',
      normalized: '.rxwf/skills/hello',
    });
  });

  it('rejects forbidden cursor path', () => {
    expect(() => normalizeRxwfSkillPath('.cursor/skills/foo')).toThrow(
      expect.objectContaining({ code: 'E1066' }),
    );
  });

  it('rejects path traversal', () => {
    expect(() => normalizeRxwfSkillPath('../secrets')).toThrow(
      expect.objectContaining({ code: 'E1066' }),
    );
  });

  it('rejects empty segments', () => {
    expect(() => normalizeRxwfSkillPath('team//ops')).toThrow(
      expect.objectContaining({ code: 'E1066' }),
    );
  });
});
