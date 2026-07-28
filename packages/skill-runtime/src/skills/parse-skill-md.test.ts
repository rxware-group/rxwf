import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSkillMd } from './parse-skill-md.js';

describe('parseSkillMd', () => {
  it('parses name and permissions from frontmatter', () => {
    const raw = readFileSync(
      join(import.meta.dirname, '../../fixtures/skills/code-review/SKILL.md'),
      'utf8',
    );
    const ir = parseSkillMd(raw, {
      skillRelPath: 'code-review',
      packageDir: '/repo/.rxwf/skills/code-review',
    });
    expect(ir.name).toBe('code-review');
    expect(ir.permissions).toContain('filesystem:read');
  });
});
