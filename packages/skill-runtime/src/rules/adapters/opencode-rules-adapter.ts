import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OpenCodePermissionSkill } from '../../skills/adapters/opencode-skill-adapter.js';

export async function readOpenCodeSkillDenylist(workspaceRoot: string): Promise<string[]> {
  for (const name of ['opencode.json', '.opencode/opencode.json']) {
    try {
      const raw = await readFile(join(workspaceRoot, name), 'utf8');
      const parsed = JSON.parse(raw) as { permission?: { skill?: OpenCodePermissionSkill } };
      const deny = parsed.permission?.skill?.deny;
      if (Array.isArray(deny)) {
        return deny.filter((d): d is string => typeof d === 'string');
      }
    } catch {
      // try next
    }
  }
  return [];
}
