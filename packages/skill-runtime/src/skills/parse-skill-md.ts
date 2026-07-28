import type { SkillIR, SkillPermission } from '../types/skill-ir.js';

const PERMISSION_SET = new Set<SkillPermission>([
  'filesystem:read',
  'code:execute',
  'network',
  'network:write',
]);

export interface ParseSkillMdContext {
  skillRelPath: string;
  packageDir: string;
  provenance?: SkillIR['provenance'];
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  if (!raw.startsWith('---')) {
    return { frontmatter: '', body: raw };
  }
  const end = raw.indexOf('\n---', 3);
  if (end === -1) {
    return { frontmatter: '', body: raw };
  }
  return {
    frontmatter: raw.slice(4, end).trim(),
    body: raw.slice(end + 4).replace(/^\s*---\s*/, '').trim(),
  };
}

function parseSimpleYaml(fm: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let listKey: string | null = null;
  for (const line of fm.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const listMatch = /^-\s+(.+)$/.exec(trimmed);
    if (listMatch && listKey) {
      const arr = (out[listKey] as string[]) ?? [];
      arr.push(listMatch[1]!.trim());
      out[listKey] = arr;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(trimmed);
    if (!kv) continue;
    const key = kv[1]!;
    const value = kv[2]!.trim();
    listKey = null;
    if (!value) {
      listKey = key;
      out[key] = [];
      continue;
    }
    if (value === 'true') out[key] = true;
    else if (value === 'false') out[key] = false;
    else out[key] = value.replace(/^["']|["']$/g, '');
  }
  return out;
}

function parsePermissions(meta: Record<string, unknown>): SkillPermission[] {
  const raw = meta.permissions ?? meta.permission;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim() as SkillPermission)
    .filter((p) => PERMISSION_SET.has(p));
}

export function parseSkillMd(raw: string, ctx: ParseSkillMdContext): SkillIR {
  const { frontmatter, body } = splitFrontmatter(raw);
  const meta = parseSimpleYaml(frontmatter);
  const name =
    (typeof meta.name === 'string' && meta.name.trim()) ||
    ctx.skillRelPath.split('/').pop() ||
    'skill';
  const description =
    (typeof meta.description === 'string' && meta.description.trim()) ||
    body.split('\n').find((l) => l.trim())?.trim() ||
    '';
  const permissions = parsePermissions(meta);
  const disableModelInvocation =
    meta['disable-model-invocation'] === true || meta.disableModelInvocation === true;

  return {
    id: `rxwf/${ctx.skillRelPath}`,
    name,
    description,
    skillRelPath: ctx.skillRelPath,
    packageDir: ctx.packageDir,
    permissions,
    provenance: ctx.provenance ?? 'rxwf',
    disableModelInvocation: disableModelInvocation || undefined,
    body: body || undefined,
  };
}

export function getSkillBody(ir: SkillIR): string {
  return ir.body ?? ir.description;
}
