export type SkillPermission =
  | 'filesystem:read'
  | 'code:execute'
  | 'network'
  | 'network:write';

export type SkillProvenance =
  | 'rxwf'
  | 'cursor'
  | 'claude'
  | 'agents_md'
  | 'opencode'
  | 'openclaw'
  | 'antigravity';

export interface SkillIR {
  id: string;
  name: string;
  description: string;
  skillRelPath: string;
  packageDir: string;
  permissions: SkillPermission[];
  provenance?: SkillProvenance;
  disableModelInvocation?: boolean;
  /** Parsed SKILL.md body (system prompt source) */
  body?: string;
}
