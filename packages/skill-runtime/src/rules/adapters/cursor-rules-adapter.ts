import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

/**
 * Import-only: copy Cursor `.cursor/rules` into `.rxwf/rules/imported/cursor/`.
 */
export async function importCursorRules(opts: {
  sourcePath: string;
  workspaceRoot: string;
  overwrite?: boolean;
}): Promise<{ imported: number; targetDir: string }> {
  const targetDir = join(opts.workspaceRoot, '.rxwf', 'rules', 'imported', 'cursor');
  await mkdir(targetDir, { recursive: true });

  let imported = 0;
  const entries = await readdir(opts.sourcePath, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.md') && !ent.name.endsWith('.mdc')) continue;
    const src = join(opts.sourcePath, ent.name);
    const dest = join(targetDir, ent.name);
    if (!opts.overwrite) {
      try {
        await readFile(dest);
        continue;
      } catch {
        // dest missing — ok
      }
    }
    const content = await readFile(src, 'utf8');
    await writeFile(dest, content, 'utf8');
    imported += 1;
  }

  return { imported, targetDir };
}

/** Import a Cursor skill directory into `.rxwf/skills/{name}/`. */
export async function importCursorSkill(opts: {
  sourcePath: string;
  workspaceRoot: string;
  skillName?: string;
  overwrite?: boolean;
}): Promise<{ skillRelPath: string; targetDir: string }> {
  const name = opts.skillName ?? basename(opts.sourcePath.replace(/\\/g, '/'));
  const targetDir = join(opts.workspaceRoot, '.rxwf', 'skills', name);
  await mkdir(targetDir, { recursive: true });
  await cp(opts.sourcePath, targetDir, {
    recursive: true,
    force: opts.overwrite ?? false,
  });
  return { skillRelPath: name, targetDir };
}
