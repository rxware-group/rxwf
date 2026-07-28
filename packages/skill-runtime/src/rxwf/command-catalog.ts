import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface RxwfCommandDef {
  id: string;
  label: string;
  action: {
    type: 'workflow_execute' | 'skill_run';
    workflowRelPath?: string;
    workflowId?: string;
    skillPath?: string;
  };
  filePath: string;
}

function parseCommandYaml(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let section: string | null = null;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed === 'action:') {
      section = 'action';
      continue;
    }
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value: unknown = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (section === 'action') {
      if (!out.action || typeof out.action !== 'object') {
        out.action = {};
      }
      (out.action as Record<string, unknown>)[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function indexRxwfCommands(workspaceRoot: string): Promise<RxwfCommandDef[]> {
  const dir = join(workspaceRoot, '.rxwf', 'commands');
  const commands: RxwfCommandDef[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return commands;
  }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.command.yaml')) continue;
    const filePath = join(dir, ent.name);
    const raw = await readFile(filePath, 'utf8');
    const meta = parseCommandYaml(raw);
    const actionRaw = meta.action as Record<string, unknown> | undefined;
    const type = String(actionRaw?.type ?? 'skill_run') as 'workflow_execute' | 'skill_run';
    commands.push({
      id: String(meta.id ?? ent.name.replace(/\.command\.yaml$/, '')),
      label: String(meta.label ?? meta.id ?? ent.name),
      action: {
        type,
        workflowRelPath: actionRaw?.workflowRelPath
          ? String(actionRaw.workflowRelPath)
          : undefined,
        workflowId: actionRaw?.workflowId ? String(actionRaw.workflowId) : undefined,
        skillPath: actionRaw?.skillPath ? String(actionRaw.skillPath) : undefined,
      },
      filePath,
    });
  }
  return commands;
}
