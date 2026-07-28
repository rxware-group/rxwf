import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import { SkillLoader, executeSkill, getSkillBody, buildSkillRunSystemPrompt } from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';

export function skillToolDefinition(
  toolNode: { id: string; name: string; parameters: Record<string, unknown> },
  parameters: Record<string, unknown>,
): ToolDefinition {
  return {
    name: toolNode.name.trim(),
    description: String(parameters.toolDescription ?? 'Run a skill'),
    parameters: { type: 'object', properties: {} },
    source: {
      type: 'skill',
      skillPath: String(parameters.skillPath ?? ''),
      mode: (parameters.mode as 'sub-agent' | 'single-shot') ?? 'sub-agent',
    },
  };
}

export async function runSkillTool(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  source: { skillPath: string; mode?: 'sub-agent' | 'single-shot' },
  llmArgs: Record<string, unknown>,
): Promise<string> {
  if (!deps.ai) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }
  const skillPath = String(source.skillPath ?? '').trim();
  if (!skillPath) {
    throw new AwfError('E1040', 'toolSkill requires skillPath');
  }
  const workspaceRoot = String(
    (ctx.config as Record<string, unknown>).workspaceRoot ?? process.cwd(),
  );
  const loader = new SkillLoader({ workspaceRoot });
  const skill = await loader.loadFromPath(skillPath);
  const userPrompt =
    typeof llmArgs.task === 'string'
      ? llmArgs.task
      : typeof llmArgs.prompt === 'string'
        ? llmArgs.prompt
        : JSON.stringify(llmArgs);

  const result = await executeSkill({
    skill,
    userPrompt,
    systemPromptOverride: buildSkillRunSystemPrompt({ skill }),
    maxIterations: source.mode === 'single-shot' ? 1 : 8,
    agent: {
      async run({ systemPrompt, userMessage, tools, invokeTool, maxIterations }) {
        const agentResult = await deps.ai!.runAgent(
          {
            model: { provider: 'ollama', model: 'llama3' },
            systemPrompt,
            userMessage,
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: { type: 'object', properties: {} },
              source: { type: 'builtin', name: t.name },
            })),
            maxIterations: maxIterations ?? 8,
            timeoutMs: 90_000,
            invokeTool: async (_def, args) => String(await invokeTool(_def.name, args)),
          },
          {
            executionId: ctx.executionId ?? '',
            workflowId: ctx.workflowId ?? '',
            nodeId: ctx.nodeId ?? '',
            environment: 'test',
          },
        );
        return { text: String(agentResult.items[0]?.json.answer ?? '') };
      },
    },
  });
  return result.text || getSkillBody(skill);
}
