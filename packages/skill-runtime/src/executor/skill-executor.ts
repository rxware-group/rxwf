import { getSkillBody } from '../skills/parse-skill-md.js';
import type { SkillIR } from '../types/skill-ir.js';

export interface SkillRunAgentPort {
  run(opts: {
    systemPrompt: string;
    userMessage: string;
    tools: Array<{ name: string; description: string; parameters?: Record<string, unknown> }>;
    invokeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
  }): Promise<{ text: string }>;
}

export interface SkillExecutorOptions {
  skill: SkillIR;
  userPrompt: string;
  /** P4: run `.rxwf/hooks` for pre/post_skill_run when true (default true). */
  runHooks?: boolean;
  workspaceRoot?: string;
  onHookResults?: (
    phase: 'pre_skill_run' | 'post_skill_run',
    results: Array<{ hookId: string; status: string }>,
  ) => void;
  /** Replaces SKILL.md body when set (e.g. after RuleResolver merge). */
  systemPromptOverride?: string;
  agent: SkillRunAgentPort;
  satelliteTools?: Array<{ name: string; description: string }>;
  invokeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxIterations?: number;
}

export async function executeSkill(opts: SkillExecutorOptions): Promise<{ text: string }> {
  const workspaceRoot = opts.workspaceRoot ?? process.cwd();
  const runHooks = opts.runHooks !== false;

  if (runHooks) {
    const { runRxwfHooks } = await import('../rxwf/hook-runner.js');
    const pre = await runRxwfHooks({
      workspaceRoot,
      event: 'pre_skill_run',
      nodeType: 'skillRun',
    });
    opts.onHookResults?.('pre_skill_run', pre);
  }

  const tools = opts.satelliteTools ?? [];
  const invokeTool =
    opts.invokeTool ??
    (async (name: string) => JSON.stringify({ error: `Tool not available: ${name}` }));

  const systemPrompt =
    opts.systemPromptOverride?.trim() ||
    getSkillBody(opts.skill);
  const result = await opts.agent.run({
    systemPrompt,
    userMessage: opts.userPrompt,
    tools,
    invokeTool,
    maxIterations: opts.maxIterations ?? 20,
  });

  if (runHooks) {
    const { runRxwfHooks } = await import('../rxwf/hook-runner.js');
    const post = await runRxwfHooks({
      workspaceRoot,
      event: 'post_skill_run',
      nodeType: 'skillRun',
    });
    opts.onHookResults?.('post_skill_run', post);
  }

  return result;
}
