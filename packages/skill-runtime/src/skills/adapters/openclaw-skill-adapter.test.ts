import { describe, expect, it } from 'vitest';
import { parseOpenClawSkillMd } from './openclaw-skill-adapter.js';

describe('parseOpenClawSkillMd', () => {
  it('passes when metadata.openclaw has no os constraint', () => {
    const raw = `---
name: demo
metadata: {"openclaw": {}}
---
Body
`;
    const ir = parseOpenClawSkillMd(
      raw,
      { skillRelPath: 'demo', packageDir: '/w/.rxwf/skills/demo' },
      { os: 'win32' },
    );
    expect(ir.name).toBe('demo');
  });

  it('throws E1054 when os does not match platform', () => {
    const raw = `---
name: linux-only
metadata: {"openclaw": {"os": ["linux"]}}
---
Body
`;
    try {
      parseOpenClawSkillMd(
        raw,
        { skillRelPath: 'linux-only', packageDir: '/w/.rxwf/skills/linux-only' },
        { os: 'win32' },
      );
      expect.fail('expected E1054');
    } catch (err) {
      expect(err).toMatchObject({ code: 'E1054' });
    }
  });
});
