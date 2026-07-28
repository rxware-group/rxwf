import { skillError } from '../errors.js';

export interface OpenClawSkillMetadata {
  requires?: string[];
  os?: string[];
}

export function parseOpenClawMetadataFromFrontmatter(
  frontmatter: Record<string, unknown>,
): OpenClawSkillMetadata | undefined {
  const raw = frontmatter['metadata.openclaw'] ?? frontmatter.metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const openclaw = (m.openclaw ?? m) as Record<string, unknown>;
  return {
    requires: Array.isArray(openclaw.requires)
      ? openclaw.requires.filter((r): r is string => typeof r === 'string')
      : undefined,
    os: Array.isArray(openclaw.os)
      ? openclaw.os.filter((r): r is string => typeof r === 'string')
      : undefined,
  };
}

export function validateOpenClawMetadata(
  meta: OpenClawSkillMetadata | undefined,
  platform: { os: string },
): void {
  if (!meta) return;
  if (meta.os?.length && !meta.os.includes(platform.os)) {
    throw skillError('E1054', `OpenClaw skill requires os: ${meta.os.join(', ')}`);
  }
}
