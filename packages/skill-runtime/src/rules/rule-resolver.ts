import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillError } from '../errors.js';
import { discoverRxwfRules } from './adapters/rxwf-rules-adapter.js';
import {
  DEPRECATED_RULE_SOURCES,
  type InstructionContextIR,
  type RuleMode,
  type RuleSource,
} from './instruction-context-ir.js';
import { filterContextsByPaths } from './context-paths.js';
import { mergeInstructionContexts } from './merge.js';

export interface RuleResolveInput {
  ruleMode?: RuleMode;
  ruleSources?: string[];
  workspaceRoot: string;
  ruleExplicitPaths?: string[];
  /** Path-scoped filter (P4): node params or Items `workingFiles`. */
  contextPaths?: string[];
  maxRuleTokens?: number;
}

export interface RuleResolveResult {
  contexts: InstructionContextIR[];
  merged: string;
  tokenEstimate: number;
}

const ALLOWED_SOURCES = new Set<RuleSource>(['rxwf_rules']);

export function assertAllowedRuleSources(sources: string[] | undefined): RuleSource[] {
  if (!sources?.length) return ['rxwf_rules'];
  for (const s of sources) {
    if (DEPRECATED_RULE_SOURCES.has(s)) {
      throw skillError('E1069', `Deprecated rule source "${s}"; use rules_import to .rxwf/rules`);
    }
    if (!ALLOWED_SOURCES.has(s as RuleSource)) {
      throw skillError('E1069', `Unsupported rule source: ${s}`);
    }
  }
  return sources as RuleSource[];
}

export async function resolveRules(input: RuleResolveInput): Promise<RuleResolveResult> {
  const mode = input.ruleMode ?? 'off';
  if (mode === 'off') {
    return { contexts: [], merged: '', tokenEstimate: 0 };
  }

  const sources = assertAllowedRuleSources(
    mode === 'inherit' ? ['rxwf_rules'] : input.ruleSources,
  );
  if (!sources.includes('rxwf_rules')) {
    return { contexts: [], merged: '', tokenEstimate: 0 };
  }

  let contexts = await discoverRxwfRules(input.workspaceRoot);

  if (input.ruleExplicitPaths?.length) {
    const explicit: InstructionContextIR[] = [];
    const root = input.workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
    for (const rel of input.ruleExplicitPaths) {
      const path = rel.startsWith('/') || /^[A-Za-z]:/.test(rel) ? rel : join(root, rel);
      try {
        const content = await readFile(path, 'utf8');
        explicit.push({
          relativePath: rel,
          content,
          sourceFormat: 'rxwf_rules',
          priority: 1000,
          loadPhase: 'always',
        });
      } catch {
        // E1051 warning at validate layer
      }
    }
    contexts = [...contexts, ...explicit];
  }

  const scoped = filterContextsByPaths(contexts, input.contextPaths ?? []);

  const { merged, contexts: used, tokenEstimate } = mergeInstructionContexts(
    scoped,
    input.maxRuleTokens,
  );

  return { contexts: used, merged, tokenEstimate };
}
