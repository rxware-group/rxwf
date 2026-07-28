import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillError } from '../errors.js';

export type RxwfHookEvent =
  | 'pre_skill_run'
  | 'post_skill_run'
  | 'pre_node_run'
  | 'post_node_run';

export interface RxwfHookDef {
  id: string;
  event: RxwfHookEvent;
  command: string;
  timeoutMs: number;
  nodeTypes?: string[];
  filePath: string;
}

function parseHookYaml(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value: unknown = trimmed.slice(idx + 1).trim();
    if (typeof value === 'string') {
      const s = value.replace(/^["']|["']$/g, '');
      if (s === 'true') value = true;
      else if (s === 'false') value = false;
      else if (/^\d+$/.test(s)) value = Number(s);
      else value = s;
    }
    out[key] = value;
  }
  return out;
}

export async function indexRxwfHooks(workspaceRoot: string): Promise<RxwfHookDef[]> {
  const dir = join(workspaceRoot, '.rxwf', 'hooks');
  const hooks: RxwfHookDef[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return hooks;
  }
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.hook.yaml')) continue;
    const filePath = join(dir, ent.name);
    const raw = await readFile(filePath, 'utf8');
    const meta = parseHookYaml(raw);
    const id = String(meta.id ?? ent.name.replace(/\.hook\.yaml$/, ''));
    const event = String(meta.event ?? '') as RxwfHookEvent;
    const command = String(meta.command ?? '').trim();
    if (!command) continue;
    const nodeTypes = Array.isArray(meta.nodeTypes)
      ? meta.nodeTypes.filter((t): t is string => typeof t === 'string')
      : undefined;
    hooks.push({
      id,
      event,
      command,
      timeoutMs: Number(meta.timeoutMs ?? 30_000),
      nodeTypes,
      filePath,
    });
  }
  return hooks;
}

export function validateHookDef(hook: RxwfHookDef): void {
  const allowed: RxwfHookEvent[] = [
    'pre_skill_run',
    'post_skill_run',
    'pre_node_run',
    'post_node_run',
  ];
  if (!allowed.includes(hook.event)) {
    throw skillError('E1065', `Invalid hook event: ${hook.event}`);
  }
  if (!hook.command) {
    throw skillError('E1065', `Hook ${hook.id} requires command`);
  }
}
