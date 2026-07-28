import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillError } from '../errors.js';
import { parseOpenClawSkillMd } from '../skills/adapters/openclaw-skill-adapter.js';
import { parseSkillMd } from '../skills/parse-skill-md.js';
import { normalizeRxwfSkillPath, resolvePackageDir } from '../skills/rxwf-path.js';
import type { SkillIR } from '../types/skill-ir.js';

export type ToolInvokeClient = {
  invoke(request: {
    capability: 'skill:filesystem' | 'shell';
    method: string;
    args: Record<string, unknown>;
    scanRoots: string[];
    timeoutMs?: number;
  }): Promise<{ status: 'success' | 'failed'; result?: unknown; errorCode?: string; errorMessage?: string }>;
};

export interface SkillLoaderOptions {
  workspaceRoot: string;
  toolInvoke?: ToolInvokeClient;
  scanRoots?: string[];
}

export class SkillLoader {
  constructor(private readonly opts: SkillLoaderOptions) {}

  async loadFromPath(skillPath: string): Promise<SkillIR> {
    const { skillRelPath, normalized } = normalizeRxwfSkillPath(skillPath);
    const packageDir = resolvePackageDir(this.opts.workspaceRoot, skillRelPath);
    const skillMdPath = join(packageDir, 'SKILL.md');

    let raw: string;
    if (this.opts.toolInvoke) {
      const scanRoots = this.opts.scanRoots ?? [this.opts.workspaceRoot];
      const res = await this.opts.toolInvoke.invoke({
        capability: 'skill:filesystem',
        method: 'read',
        args: { path: skillMdPath },
        scanRoots,
        timeoutMs: 30_000,
      });
      if (res.status !== 'success' || typeof res.result !== 'string') {
        throw skillError(res.errorCode ?? 'E1041', res.errorMessage ?? 'Failed to read SKILL.md');
      }
      raw = res.result;
    } else {
      try {
        raw = await readFile(skillMdPath, 'utf8');
      } catch {
        throw skillError('E1041', `Skill package not found: ${normalized}`);
      }
    }

    return parseOpenClawSkillMd(
      raw,
      { skillRelPath, packageDir, provenance: 'rxwf' },
      { os: process.platform },
    );
  }

  async loadInline(skillInline: string, skillRelPath = 'inline'): Promise<SkillIR> {
    const packageDir = resolvePackageDir(this.opts.workspaceRoot, skillRelPath);
    return parseOpenClawSkillMd(
      skillInline,
      { skillRelPath, packageDir, provenance: 'rxwf' },
      { os: process.platform },
    );
  }
}
