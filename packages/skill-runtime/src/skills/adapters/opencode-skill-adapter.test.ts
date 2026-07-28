import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openCodeDenylist, readOpenCodePermissionSkill } from './opencode-skill-adapter.js';

describe('OpenCode skill adapter', () => {
  it('reads permission.skill.deny from opencode.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-oc-'));
    writeFileSync(
      join(root, 'opencode.json'),
      JSON.stringify({
        permission: { skill: { deny: ['secrets', 'internal-tools'] } },
      }),
    );
    const perm = await readOpenCodePermissionSkill(root);
    expect(openCodeDenylist(perm)).toEqual(['secrets', 'internal-tools']);
  });
});
