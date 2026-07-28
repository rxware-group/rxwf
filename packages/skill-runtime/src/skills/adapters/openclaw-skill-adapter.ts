import { parseSkillMd, type ParseSkillMdContext } from '../parse-skill-md.js';
import {
  parseOpenClawMetadataFromFrontmatter,
  validateOpenClawMetadata,
} from '../openclaw-metadata.js';

function splitFrontmatter(raw: string): Record<string, unknown> {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return {};
  const fm = raw.slice(4, end).trim();
  const out: Record<string, unknown> = {};
  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'metadata' && value.startsWith('{')) {
      try {
        out.metadata = JSON.parse(value);
      } catch {
        out.metadata = value;
      }
    }
  }
  return out;
}

export function parseOpenClawSkillMd(
  raw: string,
  ctx: ParseSkillMdContext,
  platform: { os: string },
) {
  const meta = splitFrontmatter(raw);
  const openclaw = parseOpenClawMetadataFromFrontmatter(meta);
  validateOpenClawMetadata(openclaw, platform);
  return parseSkillMd(raw, ctx);
}
