import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface OpenCodePermissionSkill {
  allow?: string[];
  deny?: string[];
  ask?: string[];
}

export async function readOpenCodePermissionSkill(
  workspaceRoot: string,
): Promise<OpenCodePermissionSkill | null> {
  for (const name of ['opencode.json', '.opencode/opencode.json']) {
    try {
      const raw = await readFile(join(workspaceRoot, name), 'utf8');
      const parsed = JSON.parse(raw) as { permission?: { skill?: OpenCodePermissionSkill } };
      return parsed.permission?.skill ?? null;
    } catch {
      // try next
    }
  }
  return null;
}

export function openCodeDenylist(skill: OpenCodePermissionSkill | null): string[] {
  if (!skill?.deny?.length) return [];
  return skill.deny.filter((d): d is string => typeof d === 'string');
}
