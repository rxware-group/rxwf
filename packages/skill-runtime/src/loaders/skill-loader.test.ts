import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillLoader } from './skill-loader.js';

describe('SkillLoader', () => {
  it('loads SKILL.md under .rxwf/skills/{pkg}', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-'));
    const pkg = join(root, '.rxwf', 'skills', 'code-review');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: code-review\npermissions:\n  - filesystem:read\n---\n\nReview code.\n',
    );
    const loader = new SkillLoader({ workspaceRoot: root });
    const ir = await loader.loadFromPath('.rxwf/skills/code-review');
    expect(ir.skillRelPath).toBe('code-review');
  });

  it('throws E1066 for .cursor/skills path', async () => {
    const loader = new SkillLoader({ workspaceRoot: '/tmp' });
    await expect(loader.loadFromPath('.cursor/skills/foo')).rejects.toMatchObject({
      code: 'E1066',
    });
  });
});
