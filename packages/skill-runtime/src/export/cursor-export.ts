import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Export `.rxwf/skills/{name}` → `{workspaceRoot}/.cursor/skills/{name}` (optional IDE sync). */
export async function exportSkillToCursor(opts: {
  workspaceRoot: string;
  skillRelPath: string;
  overwrite?: boolean;
}): Promise<{ targetDir: string }> {
  const src = join(opts.workspaceRoot, '.rxwf', 'skills', opts.skillRelPath);
  const targetDir = join(opts.workspaceRoot, '.cursor', 'skills', opts.skillRelPath);
  await mkdir(join(opts.workspaceRoot, '.cursor', 'skills'), { recursive: true });
  await cp(src, targetDir, { recursive: true, force: opts.overwrite ?? false });
  return { targetDir };
}
