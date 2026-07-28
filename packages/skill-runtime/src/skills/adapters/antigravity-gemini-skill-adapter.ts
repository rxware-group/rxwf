import { cp, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { skillError } from '../../errors.js';

/** Default Antigravity IDE skill root: `~/.gemini/antigravity/skills`. */
export function defaultAntigravityGeminiSkillsRoot(): string {
  return join(homedir(), '.gemini', 'antigravity', 'skills');
}

/**
 * Import-only: copy from `~/.gemini/antigravity/skills/{name}` (or explicit sourcePath)
 * into `{workspaceRoot}/.rxwf/skills/{skillRelPath}/`.
 */
export async function importAntigravityGeminiSkill(opts: {
  workspaceRoot: string;
  skillName?: string;
  sourcePath?: string;
  overwrite?: boolean;
}): Promise<{ skillRelPath: string; targetDir: string; sourcePath: string }> {
  const name = opts.skillName?.trim();
  const root = opts.sourcePath?.trim() || defaultAntigravityGeminiSkillsRoot();
  const sourceDir = name ? join(root, name) : root;
  const skillRelPath = name ?? basename(sourceDir.replace(/\\/g, '/'));
  if (!skillRelPath) {
    throw skillError('E1040', 'skillName or sourcePath required for antigravity_gemini import');
  }
  const targetDir = join(opts.workspaceRoot, '.rxwf', 'skills', skillRelPath);
  await mkdir(join(opts.workspaceRoot, '.rxwf', 'skills'), { recursive: true });
  try {
    await cp(sourceDir, targetDir, { recursive: true, force: opts.overwrite ?? false });
  } catch {
    throw skillError('E1041', `Antigravity skill package not found: ${sourceDir}`);
  }
  return { skillRelPath, targetDir, sourcePath: sourceDir };
}
