import { join } from 'node:path';
import {
  SkillLoader,
  executeSkill,
  getSkillBody,
  resolveRules,
  importCursorSkill,
} from '@rxwf/skill-runtime';
import type { McpExtraTool } from '@rxwf/mcp-server';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { createLiteSkillRepository } from '@rxwf/providers-lite';
import { AwfError } from '@rxwf/shared';

export const SKILL_MCP_TOOL_NAMES = [
  'skill_list',
  'skill_get',
  'skill_run',
  'skill_import',
  'rules_resolve',
  'rules_list',
] as const;

const SKILL_MCP_TOOLS: McpExtraTool[] = [
  { name: 'skill_list', description: 'List registered skills (args: keyword?)' },
  { name: 'skill_get', description: 'Get skill metadata (args: skillId)' },
  { name: 'skill_run', description: 'Run skill synchronously (args: skillId, prompt, workspaceRoot?)' },
  { name: 'skill_import', description: 'Import skill from sourcePath (args: sourcePath, workspaceRoot?)' },
  { name: 'rules_resolve', description: 'Preview merged rules (args: workspaceRoot, ruleMode, ruleSources?)' },
  { name: 'rules_list', description: 'List indexed rule files under .rxwf/rules (args: workspaceRoot?)' },
];

export interface SkillMcpBindings {
  ai: AiRuntime;
  defaultWorkspaceRoot?: string;
}

let bindings: SkillMcpBindings | undefined;

export function setSkillMcpBindings(next: SkillMcpBindings): void {
  bindings = next;
}

export function createSkillMcpHandlers(db: LiteDatabase) {
  const repo = createLiteSkillRepository(db);

  return {
    listExtraTools(): Promise<McpExtraTool[]> {
      return Promise.resolve(SKILL_MCP_TOOLS);
    },

    async callExtraTool(name: string, args: Record<string, unknown>): Promise<string> {
      switch (name) {
        case 'skill_list': {
          const keyword = String(args.keyword ?? '').trim().toLowerCase();
          const items = await repo.list();
          const filtered = keyword
            ? items.filter(
                (s) =>
                  s.name.toLowerCase().includes(keyword) ||
                  s.slug.toLowerCase().includes(keyword),
              )
            : items;
          return JSON.stringify(filtered);
        }
        case 'skill_get': {
          const skillId = String(args.skillId ?? '').trim();
          const skill = await repo.getById(skillId);
          if (!skill) throw new Error('Skill not found');
          return JSON.stringify(skill);
        }
        case 'skill_import': {
          const workspaceRoot = String(
            args.workspaceRoot ?? bindings?.defaultWorkspaceRoot ?? process.cwd(),
          ).trim();
          const sourcePath = String(args.sourcePath ?? args.path ?? '').trim();
          if (!sourcePath) throw new AwfError('E1040', 'sourcePath required');
          const result = await importCursorSkill({
            workspaceRoot,
            sourcePath,
            overwrite: args.overwrite === true,
          });
          return JSON.stringify(result);
        }
        case 'rules_resolve': {
          const workspaceRoot = String(
            args.workspaceRoot ?? bindings?.defaultWorkspaceRoot ?? process.cwd(),
          ).trim();
          const ruleMode = (args.ruleMode as 'off' | 'inherit' | 'explicit') ?? 'inherit';
          const ruleSources = Array.isArray(args.ruleSources)
            ? (args.ruleSources as string[])
            : undefined;
          const resolved = await resolveRules({
            workspaceRoot,
            ruleMode,
            ruleSources,
            contextPaths: Array.isArray(args.contextPaths)
              ? (args.contextPaths as string[])
              : undefined,
          });
          return JSON.stringify(resolved);
        }
        case 'rules_list': {
          const workspaceRoot = String(
            args.workspaceRoot ?? bindings?.defaultWorkspaceRoot ?? process.cwd(),
          ).trim();
          const base = join(workspaceRoot, '.rxwf', 'rules');
          const files: string[] = [];
          async function walk(dir: string, rel: string): Promise<void> {
            const { readdir } = await import('node:fs/promises');
            let entries;
            try {
              entries = await readdir(dir, { withFileTypes: true });
            } catch {
              return;
            }
            for (const ent of entries) {
              const r = rel ? `${rel}/${ent.name}` : ent.name;
              if (ent.isDirectory()) await walk(join(dir, ent.name), r);
              else if (ent.isFile() && /\.(md|txt)$/i.test(ent.name)) files.push(r);
            }
          }
          await walk(base, '');
          return JSON.stringify({ workspaceRoot, files });
        }
        case 'skill_run': {
          if (!bindings?.ai) {
            throw new Error('skill_run requires AI runtime');
          }
          const workspaceRoot = String(
            args.workspaceRoot ?? bindings.defaultWorkspaceRoot ?? process.cwd(),
          ).trim();
          const skillId = String(args.skillId ?? '').trim();
          const prompt = String(args.prompt ?? '').trim();
          if (!skillId || !prompt) {
            throw new AwfError('E1040', 'skillId and prompt required');
          }
          const row = await repo.getById(skillId);
          const skillPath = row
            ? `.rxwf/skills/${row.slug}`
            : skillId.startsWith('.rxwf/')
              ? skillId
              : `.rxwf/skills/${skillId}`;
          const loader = new SkillLoader({ workspaceRoot });
          const skill = await loader.loadFromPath(skillPath);
          const result = await executeSkill({
            skill,
            userPrompt: prompt,
            workspaceRoot,
            maxIterations: 5,
            agent: {
              async run({ systemPrompt, userMessage, tools, invokeTool, maxIterations }) {
                let text = '';
                for await (const chunk of bindings!.ai.chat(
                  [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                  ],
                  { model: { provider: 'ollama', model: 'llama3' } },
                )) {
                  text += chunk;
                }
                void tools;
                void invokeTool;
                void maxIterations;
                return { text };
              },
            },
          });
          return JSON.stringify({
            answer: result.text,
            skillId: skill.id,
            bodyPreview: getSkillBody(skill).slice(0, 200),
          });
        }
        default:
          throw new Error(`Unknown skill MCP tool: ${name}`);
      }
    },
  };
}
