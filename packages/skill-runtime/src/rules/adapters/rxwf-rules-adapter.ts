import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { InstructionContextIR } from '../instruction-context-ir.js';

async function collectMdFiles(
  dir: string,
  baseLabel: string,
  priorityBase: number,
  sourceFormat: InstructionContextIR['sourceFormat'],
): Promise<InstructionContextIR[]> {
  const out: InstructionContextIR[] = [];
  let entries: Array<{ name: string; isDirectory: boolean }>;
  try {
    const raw = await readdir(dir, { withFileTypes: true });
    entries = raw.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  } catch {
    return out;
  }

  for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, ent.name);
    if (ent.isDirectory) {
      out.push(
        ...(await collectMdFiles(
          full,
          `${baseLabel}/${ent.name}`,
          priorityBase + 10,
          sourceFormat,
        )),
      );
      continue;
    }
    if (!ent.name.endsWith('.md') && !ent.name.endsWith('.mdc')) continue;
    try {
      const content = await readFile(full, 'utf8');
      out.push({
        relativePath: `${baseLabel}/${ent.name}`.replace(/^\//, ''),
        content,
        sourceFormat,
        priority: priorityBase + out.length,
        loadPhase: 'always',
      });
    } catch {
      // skip unreadable
    }
  }
  return out;
}

export async function discoverRxwfRules(workspaceRoot: string): Promise<InstructionContextIR[]> {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const contexts: InstructionContextIR[] = [];

  const homeRxwf = join(
    process.env.HOME ?? process.env.USERPROFILE ?? '',
    '.rxwf',
    'rules',
  );
  contexts.push(...(await collectMdFiles(homeRxwf, '~/.rxwf/rules', 0, 'rxwf_rules')));

  const imported = join(root, '.rxwf', 'rules', 'imported');
  contexts.push(
    ...(await collectMdFiles(imported, '.rxwf/rules/imported', 100, 'rxwf_rules_imported')),
  );

  const projectRules = join(root, '.rxwf', 'rules');
  const handWritten: InstructionContextIR[] = [];
  try {
    const raw = await readdir(projectRules, { withFileTypes: true });
    for (const ent of raw) {
      if (ent.isDirectory() && ent.name === 'imported') continue;
      const full = join(projectRules, ent.name);
      if (ent.isDirectory()) {
        handWritten.push(
          ...(await collectMdFiles(full, `.rxwf/rules/${ent.name}`, 200, 'rxwf_rules')),
        );
      } else if (ent.name.endsWith('.md') || ent.name.endsWith('.mdc')) {
        const content = await readFile(full, 'utf8');
        handWritten.push({
          relativePath: `.rxwf/rules/${ent.name}`,
          content,
          sourceFormat: 'rxwf_rules',
          priority: 200,
          loadPhase: 'always',
        });
      }
    }
  } catch {
    // no rules dir
  }
  contexts.push(...handWritten);

  return contexts;
}
