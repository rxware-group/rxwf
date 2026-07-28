export type RuleSource = 'rxwf_rules';

export type RuleMode = 'off' | 'inherit' | 'explicit';

export const DEPRECATED_RULE_SOURCES = new Set([
  'cursor_rules',
  'claude_md',
  'claude_rules',
  'agents_md',
]);

export interface InstructionContextIR {
  relativePath: string;
  content: string;
  sourceFormat: RuleSource | 'rxwf_rules_imported';
  priority: number;
  paths?: string[];
  loadPhase?: 'always' | 'on_request';
}
