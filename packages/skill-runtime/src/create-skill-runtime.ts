import type { WebSearchPort } from '@rxwf/providers-contracts';
import { SkillLoader, type ToolInvokeClient } from './loaders/skill-loader.js';
import { executeSkill, type SkillRunAgentPort } from './executor/skill-executor.js';

export interface SkillRuntimeOptions {
  workspaceRoot: string;
  toolInvoke?: ToolInvokeClient;
  scanRoots?: string[];
  webSearch?: WebSearchPort;
  agent: SkillRunAgentPort;
  webSearchEnabled?: boolean;
}

export function createSkillRuntime(opts: SkillRuntimeOptions) {
  const loader = new SkillLoader({
    workspaceRoot: opts.workspaceRoot,
    toolInvoke: opts.toolInvoke,
    scanRoots: opts.scanRoots,
  });

  return {
    loader,
    executeSkill: (params: Parameters<typeof executeSkill>[0]) => executeSkill(params),
    webSearch: opts.webSearch,
  };
}
