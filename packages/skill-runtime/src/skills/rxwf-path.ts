import { skillError } from '../errors.js';

const RXWF_SKILL_PREFIX = /^\.rxwf\/skills\/([^/]+(?:\/[^/]+)*)\/?$/;
const FORBIDDEN_PREFIXES = [
  '.cursor/skills',
  '.claude/skills',
  '.agents/skills',
  '.opencode/skills',
  '.agent/skills',
];

function assertSafeSkillRelPath(skillRelPath: string, original: string): string {
  const cleaned = skillRelPath.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/+/, '');
  if (!cleaned) {
    throw skillError('E1066', `Invalid skill name: ${original}`);
  }
  if (cleaned.includes('..')) {
    throw skillError('E1066', `Invalid skill path: ${original}`);
  }
  const segments = cleaned.split('/');
  if (segments.some((segment) => !segment || segment === '.')) {
    throw skillError('E1066', `Invalid skill path: ${original}`);
  }
  return cleaned;
}

function rejectForbiddenPaths(path: string, original: string): void {
  for (const forbidden of FORBIDDEN_PREFIXES) {
    if (path.startsWith(forbidden) || path.includes(`/${forbidden}`)) {
      throw skillError('E1066', `Skill path must be under .rxwf/skills: ${original}`);
    }
  }
}

/** Normalize skill input to `.rxwf/skills/{skillRelPath}`. Accepts bare names (e.g. `hello`). */
export function normalizeRxwfSkillPath(skillPath: string): {
  skillRelPath: string;
  normalized: string;
} {
  const trimmed = skillPath.trim().replace(/\\/g, '/');
  if (!trimmed) {
    throw skillError('E1066', 'Skill name is required');
  }
  rejectForbiddenPaths(trimmed, skillPath);

  if (/^[a-zA-Z]:[/\\]/.test(trimmed) || trimmed.startsWith('/')) {
    throw skillError('E1066', `Skill must be a name under .rxwf/skills: ${skillPath}`);
  }

  let path = trimmed;
  if (path.startsWith('skills/')) {
    path = `.rxwf/${path}`;
  }

  if (path.startsWith('.rxwf/skills/')) {
    const match = RXWF_SKILL_PREFIX.exec(path);
    if (!match?.[1]) {
      throw skillError(
        'E1067',
        'SKILL.md must live in .rxwf/skills/{package}/, not directly under skills/',
      );
    }
    const skillRelPath = assertSafeSkillRelPath(match[1], skillPath);
    return { skillRelPath, normalized: `.rxwf/skills/${skillRelPath}` };
  }

  if (path.startsWith('.')) {
    throw skillError('E1066', `Skill path must be under .rxwf/skills: ${skillPath}`);
  }

  const skillRelPath = assertSafeSkillRelPath(path, skillPath);
  return { skillRelPath, normalized: `.rxwf/skills/${skillRelPath}` };
}

export function resolvePackageDir(workspaceRoot: string, skillRelPath: string): string {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
  return `${root}/.rxwf/skills/${skillRelPath}`;
}
