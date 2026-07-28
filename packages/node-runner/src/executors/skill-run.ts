import { collectSatellites } from '@rxwf/workflow';
import type { ToolDefinition } from '@rxwf/ai-runtime-stub';
import {
  SkillLoader,
  buildSkillRunSystemPrompt,
  dispatchWebSearch,
  executeSkill,
  formatIntentHints,
  getSkillBody,
  matchToolIntents,
  normalizeRxwfSkillPath,
  openCodeDenylist,
  readOpenCodePermissionSkill,
} from '@rxwf/skill-runtime';
import type { SkillIR } from '@rxwf/skill-runtime';
import { appendFile, mkdir, readFile, realpath, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { RunnerToolInvokeRequest, RunnerToolInvokeResult } from '@rxwf/runner-protocol';
import type { RunnerGatewayPort } from '@rxwf/providers-contracts';
import { buildRuleSystemAppendix } from './rule-inject.js';
import { AwfError } from '@rxwf/shared';
import type { WorkflowItem } from '@rxwf/shared';
import { resolveAgentParameters } from '../expression/resolve-agent-params.js';
import {
  resolveAgentPromptRaw,
  resolveAgentUserMessage,
} from '../expression/resolve-agent-prompt.js';
import {
  type ItemTemplateScope,
  resolveInputItemTemplateString,
} from '../expression/item-context.js';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import {
  buildAgentToolDefinitions,
  invokeAgentTool,
  type AgentToolInvokeContext,
} from './agent-satellite-tools.js';
import {
  createAgentHubInvokeTool,
  preloadChildWorkflowSchemas,
} from './agent-hub-invoke-tool.js';
import { resolveSkillRunTimeoutMs } from './resolve-skill-run-timeout.js';

const SKILL_RUN_EMBEDDED_RUNNER_ID = '__skill_run_embedded__';
const FILESYSTEM_SATELLITE_TYPES = new Set(['toolRead', 'toolWrite', 'toolGrep']);
const DEFAULT_GREP_MAX_RESULTS = 50;

function isInsideScanRoots(target: string, scanRoots: string[]): boolean {
  const normalized = target.replace(/\\/g, '/');
  return scanRoots.some((root) => {
    const r = root.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === r || normalized.startsWith(`${r}/`);
  });
}

async function resolvePathWithinScanRoots(
  path: string,
  scanRoots: string[],
): Promise<string | null> {
  try {
    const abs = resolve(path);
    const rp = await realpath(abs);
    if (!isInsideScanRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    return null;
  }
}

async function resolveWritePath(path: string, scanRoots: string[]): Promise<string | null> {
  const abs = resolve(path);
  try {
    const rp = await realpath(abs);
    if (!isInsideScanRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    const parent = dirname(abs);
    try {
      const parentRp = await realpath(parent);
      if (!isInsideScanRoots(parentRp, scanRoots)) return null;
      if (!isInsideScanRoots(abs, scanRoots)) return null;
      return abs;
    } catch {
      if (!isInsideScanRoots(abs, scanRoots)) return null;
      return abs;
    }
  }
}

function compileGrepRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch {
    throw new AwfError('E2002', `Invalid grep regex: ${pattern}`);
  }
}

function matchesGrepGlob(fileName: string, glob?: string): boolean {
  if (!glob) return true;
  const g = glob.replace(/\\/g, '/');
  if (g.startsWith('**/')) {
    const suffix = g.slice(3);
    if (suffix.startsWith('*.')) {
      return fileName.endsWith(suffix.slice(1));
    }
    return fileName.includes(suffix);
  }
  if (g.startsWith('*.')) {
    return fileName.endsWith(g.slice(1));
  }
  return fileName === g || fileName.endsWith(`/${g}`);
}

async function invokeSkillRunFilesystem(
  request: RunnerToolInvokeRequest,
): Promise<RunnerToolInvokeResult> {
  const started = Date.now();
  const scanRoots = request.scanRoots ?? [];
  const fail = (errorCode: string, errorMessage: string): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'failed',
    errorCode,
    errorMessage,
    durationMs: Date.now() - started,
  });
  const success = (result: unknown): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'success',
    result,
    durationMs: Date.now() - started,
  });

  if (request.capability !== 'skill:filesystem') {
    return fail('E2002', `Unknown capability: ${request.capability}`);
  }

  const method = request.method;
  const args = request.args;

  if (method === 'read') {
    const path = String(args.path ?? '');
    const resolved = await resolvePathWithinScanRoots(path, scanRoots);
    if (!resolved) {
      return fail('E1056', 'Path outside scanRoots');
    }
    try {
      const content = await readFile(resolved, 'utf8');
      return success(content);
    } catch (e) {
      return fail('E1041', e instanceof Error ? e.message : String(e));
    }
  }

  if (method === 'write') {
    const path = String(args.path ?? '').trim();
    if (!path) {
      return fail('E2002', 'path is required');
    }
    const content = String(args.content ?? '');
    const resolved = await resolveWritePath(path, scanRoots);
    if (!resolved) {
      return fail('E1056', 'Path outside scanRoots');
    }
    try {
      await mkdir(dirname(resolved), { recursive: true });
      if (args.append === true) {
        await appendFile(resolved, content, 'utf8');
      } else {
        await writeFile(resolved, content, 'utf8');
      }
      return success({
        path: resolved,
        bytesWritten: Buffer.byteLength(content, 'utf8'),
      });
    } catch (e) {
      return fail('E1041', e instanceof Error ? e.message : String(e));
    }
  }

  if (method === 'grep') {
    const pattern = String(args.pattern ?? '').trim();
    if (!pattern) {
      return fail('E2002', 'grep pattern is required');
    }
    const startPath = args.path ? String(args.path) : scanRoots[0] ?? '.';
    const glob = args.glob ? String(args.glob) : undefined;
    if (args.path) {
      const resolved = await resolvePathWithinScanRoots(startPath, scanRoots);
      if (!resolved) {
        return fail('E1056', 'Path outside scanRoots');
      }
    }

    let regex: RegExp;
    try {
      regex = compileGrepRegex(pattern);
    } catch (e) {
      if (e instanceof AwfError) {
        return fail(e.code, e.message);
      }
      throw e;
    }

    const matches: Array<{ path: string; line: number; column: number; text: string }> = [];
    const maxResults = DEFAULT_GREP_MAX_RESULTS;

    const searchFile = async (filePath: string) => {
      const text = await readFile(filePath, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const match = regex.exec(line);
        if (!match) continue;
        matches.push({
          path: filePath,
          line: i + 1,
          column: (match.index ?? 0) + 1,
          text: line,
        });
        if (matches.length >= maxResults) return;
      }
    };

    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxResults) return;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile() && matchesGrepGlob(entry.name, glob)) {
          await searchFile(full);
        }
      }
    };

    try {
      const resolvedStart = await resolvePathWithinScanRoots(startPath, scanRoots);
      if (!resolvedStart) {
        return fail('E1056', 'Path outside scanRoots');
      }
      const info = await stat(resolvedStart);
      if (info.isFile()) {
        if (matchesGrepGlob(resolvedStart.split(/[/\\]/).pop() ?? '', glob)) {
          await searchFile(resolvedStart);
        }
      } else if (info.isDirectory()) {
        await walk(resolvedStart);
      }
      return success({ matches, grepFallback: true });
    } catch (e) {
      return fail('E1041', e instanceof Error ? e.message : String(e));
    }
  }

  return fail('E2002', `Unknown filesystem method: ${method}`);
}

function createSkillRunEmbeddedGateway(): RunnerGatewayPort {
  return {
    async invokeTool(_runnerId, request) {
      return invokeSkillRunFilesystem(request);
    },
  } as RunnerGatewayPort;
}

function skillHasNetworkPermission(skill: SkillIR): boolean {
  return skill.permissions.includes('network') || skill.permissions.includes('network:write');
}

function buildSkillRunAgentToolCtx(
  base: AgentToolInvokeContext,
  deps: PlusExecutorDeps,
  toolNodeById: Map<string, import('@rxwf/workflow').WorkflowNode>,
): AgentToolInvokeContext {
  const embeddedGateway = createSkillRunEmbeddedGateway();
  const runnerGateway: RunnerGatewayPort | undefined = deps.runnerGateway
    ? ({
        async invokeTool(runnerId, request, opts) {
          if (runnerId === SKILL_RUN_EMBEDDED_RUNNER_ID) {
            return embeddedGateway.invokeTool(runnerId, request, opts);
          }
          return deps.runnerGateway!.invokeTool(runnerId, request, opts);
        },
      } as RunnerGatewayPort)
    : embeddedGateway;

  return {
    ...base,
    runnerGateway,
    resolveRunnerForToolNode: async (toolNodeId) => {
      const toolNode = toolNodeById.get(toolNodeId);
      if (toolNode && FILESYSTEM_SATELLITE_TYPES.has(toolNode.type)) {
        if (base.resolveRunnerForToolNode) {
          const resolved = await base.resolveRunnerForToolNode(toolNodeId);
          if (resolved) return resolved;
        }
        return { kind: 'agent', id: SKILL_RUN_EMBEDDED_RUNNER_ID };
      }
      return base.resolveRunnerForToolNode?.(toolNodeId);
    },
    webSearch: deps.webSearch,
  };
}

async function invokeSkillRunSatelliteTool(
  def: ToolDefinition,
  args: Record<string, unknown>,
  ctx: AgentToolInvokeContext,
  skill: SkillIR,
): Promise<unknown> {
  const source = def.source;
  if (source.type === 'web_search') {
    const query = String(args.query ?? args.q ?? '').trim();
    if (!query) {
      throw new AwfError('E1071', 'web_search requires a non-empty query');
    }
    const resolved = ctx.resolveRunnerForToolNode
      ? await ctx.resolveRunnerForToolNode(source.toolNodeId)
      : undefined;
    if (resolved?.kind === 'agent' && resolved.id && ctx.runnerGateway) {
      return invokeAgentTool(def, args, ctx);
    }
    const summary = await dispatchWebSearch(
      ctx.webSearch,
      { query },
      skillHasNetworkPermission(skill),
      {
        maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
      },
    );
    return summary;
  }
  return invokeAgentTool(def, args, ctx);
}


function modelFromSatellite(satellites: ReturnType<typeof collectSatellites>): import('@rxwf/ai-runtime-stub').ModelRef {
  if (!satellites.model) {
    throw new AwfError('E1043', 'skillRun requires aiChatModel satellite');
  }
  const p = satellites.model.parameters;
  return {
    provider: String(p.provider ?? 'ollama'),
    model: String(p.model ?? 'llama3'),
    baseUrl: p.baseUrl ? String(p.baseUrl) : undefined,
    credentialId: p.credentialId ? String(p.credentialId) : undefined,
  };
}

async function resolveSkillRunWorkspace(
  params: Record<string, unknown>,
  rawConfig: Record<string, unknown>,
  templateScope: ItemTemplateScope,
  itemIndex: number,
  deps: PlusExecutorDeps,
): Promise<{ workspaceRoot: string; scanRoots: string[] }> {
  const skillSource = String(params.skillSource ?? rawConfig.skillSource ?? 'path');
  let workspaceRoot: string;
  if (skillSource === 'registry') {
    workspaceRoot = String((await deps.getRxwfWorkspaceRoot?.()) ?? '').trim();
    if (!workspaceRoot) {
      throw new AwfError('E1040', 'RxWF workspace not configured');
    }
  } else {
    const rawWs = String(rawConfig.workspaceRoot ?? params.workspaceRoot ?? process.cwd()).trim();
    workspaceRoot = await resolveInputItemTemplateString(rawWs, templateScope, itemIndex);
  }
  const scanRoots = Array.isArray(params.scanRoots)
    ? (params.scanRoots as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.length > 0,
      )
    : [workspaceRoot];
  return { workspaceRoot, scanRoots };
}

async function loadSkillFromParams(
  params: Record<string, unknown>,
  rawConfig: Record<string, unknown>,
  templateScope: ItemTemplateScope,
  itemIndex: number,
  loader: SkillLoader,
  workspaceRoot: string,
  deps: PlusExecutorDeps,
): Promise<SkillIR> {
  const skillSource = String(params.skillSource ?? rawConfig.skillSource ?? 'path');
  if (skillSource === 'path') {
    const rawPath = String(rawConfig.skillPath ?? params.skillPath ?? '').trim();
    const skillPath = await resolveInputItemTemplateString(rawPath, templateScope, itemIndex);
    if (!skillPath.trim()) {
      throw new AwfError('E1040', 'skillPath is required');
    }
    const { skillRelPath } = normalizeRxwfSkillPath(skillPath);
    const deny = openCodeDenylist(await readOpenCodePermissionSkill(workspaceRoot));
    for (const pattern of deny) {
      if (skillRelPath === pattern || skillRelPath.startsWith(`${pattern}/`)) {
        throw new AwfError(
          'E1063',
          `Skill path denied by OpenCode permission.skill: ${pattern}`,
        );
      }
    }
    return loader.loadFromPath(skillPath);
  }
  if (skillSource === 'registry') {
    const rawId = String(rawConfig.skillId ?? params.skillId ?? '').trim();
    const skillId = await resolveInputItemTemplateString(rawId, templateScope, itemIndex);
    if (!skillId.trim()) {
      throw new AwfError('E1040', 'skillId is required for registry source');
    }
    if (!deps.loadSkillFromRegistry) {
      throw new AwfError('E1040', 'Skill registry is not configured on this runtime');
    }
    const loaded = await deps.loadSkillFromRegistry(skillId);
    if (!loaded) {
      throw new AwfError('E1041', `Skill not found in registry: ${skillId}`);
    }
    return loader.loadInline(loaded.skillMd, loaded.skillRelPath);
  }
  throw new AwfError('E1040', `Unsupported skillSource: ${skillSource}`);
}

export function createSkillRunExecutor(deps: PlusExecutorDeps) {
  return {
    type: 'skillRun',
    async execute(ctx: NodeExecutionContext): Promise<NodeRunResult> {
      if (!deps.ai) {
        throw new AwfError('E3001', 'AI runtime not configured');
      }
      const nodeId = ctx.nodeId;
      if (!nodeId || !ctx.workflowDefinition) {
        throw new AwfError('E2003', 'skillRun requires workflow definition context');
      }

      const inputItems = ctx.inputItems;
      const itemCount = Math.max(1, inputItems.length);
      const templateScope: ItemTemplateScope = { ...ctx, inputItems };
      const rawConfig = ctx.config;

      const satellites = collectSatellites(ctx.workflowDefinition, nodeId);
      if (!satellites.model) {
        throw new AwfError('E1043', 'skillRun requires aiChatModel satellite');
      }
      const model = deps.resolveOllamaModelRef
        ? await deps.resolveOllamaModelRef(satellites.model.parameters)
        : modelFromSatellite(satellites);

      const childWorkflowSchemas = await preloadChildWorkflowSchemas(deps, satellites.tools);
      const toolDefs = buildAgentToolDefinitions(satellites.tools, {
        childWorkflowSchemas,
        locale: ctx.locale,
      });
      const toolDefByName = new Map(toolDefs.map((t) => [t.name, t]));
      const satelliteTools = toolDefs.map((t) => ({
        name: t.name,
        description: t.description,
      }));
      const toolNodeById = new Map(satellites.tools.map((t) => [t.id, t]));
      const toolNodeByName = new Map(satellites.tools.map((t) => [t.name.trim(), t]));
      const timeoutMs = resolveSkillRunTimeoutMs(rawConfig, ctx.env);

      const outputRow: WorkflowItem[] = [];

      for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
        const params = await resolveAgentParameters(
          rawConfig,
          templateScope,
          inputItems,
          itemIndex,
        );

        const { workspaceRoot, scanRoots } = await resolveSkillRunWorkspace(
          params,
          rawConfig,
          templateScope,
          itemIndex,
          deps,
        );

        const loader = new SkillLoader({
          workspaceRoot,
          scanRoots,
        });

        const skill = await loadSkillFromParams(
          params,
          rawConfig,
          templateScope,
          itemIndex,
          loader,
          workspaceRoot,
          deps,
        );

        if (skill.disableModelInvocation) {
          outputRow.push({
            json: {
              answer: skill.description,
              skippedModel: true,
              skillId: skill.id,
            },
          });
          continue;
        }

        const userMessage = await resolveAgentUserMessage(
          rawConfig,
          templateScope,
          itemIndex,
        );
        if (!userMessage.trim() && resolveAgentPromptRaw(rawConfig).trim()) {
          const emptyPromptError =
            itemCount > 1
              ? `Prompt resolved to empty for input item ${itemIndex + 1}`
              : 'Prompt resolved to empty for structured output';
          ctx.onAgentStream?.({
            type: 'agent_step',
            step: {
              kind: 'structuredOutputFailed',
              itemIndex: itemIndex + 1,
              itemCount,
              userMessage: '',
              answer: '',
              error: emptyPromptError,
              errorCode: 'E3013',
            },
          });
          throw new AwfError('E3013', emptyPromptError);
        }

        ctx.onAgentStream?.({
          type: 'agent_step',
          step: {
            kind: 'agentItemStart',
            itemIndex: itemIndex + 1,
            itemCount,
            userMessage,
          },
        });

        const userSystemPrompt = String(params.systemPrompt ?? '');

        let intentAppendix = '';
        if (satellites.tools.length > 0) {
          const wired = satellites.tools.map((t) => ({
            name: String(t.parameters.toolName ?? t.name ?? t.type),
            type: t.type,
          }));
          intentAppendix = formatIntentHints(matchToolIntents(getSkillBody(skill), wired));
        }

        const ruleAppendix = await buildRuleSystemAppendix({
          ruleMode: (params.ruleMode as 'off' | 'inherit' | 'explicit') ?? 'off',
          ruleSources: Array.isArray(params.ruleSources)
            ? (params.ruleSources as string[])
            : undefined,
          workspaceRoot,
          ruleExplicitPaths: Array.isArray(params.ruleExplicitPaths)
            ? (params.ruleExplicitPaths as string[])
            : undefined,
          maxRuleTokens: Number(params.maxRuleTokens ?? 0) || undefined,
          inputItems,
          nodeParams: params,
        });

        const systemPromptOverride = buildSkillRunSystemPrompt({
          skill,
          intentAppendix,
          ruleAppendix,
          userSystemPrompt,
          locale: ctx.locale,
        });

        const baseAgentToolCtx: AgentToolInvokeContext = {
          scanRoots,
          executionId: ctx.executionId,
          nodeRunId: nodeId,
          runnerGateway: deps.runnerGateway,
          webSearch: deps.webSearch,
        };
        const agentToolCtx = buildSkillRunAgentToolCtx(baseAgentToolCtx, deps, toolNodeById);

        const invokeHubTool = createAgentHubInvokeTool({
          deps,
          ctx,
          toolNodeByName,
          agentToolCtx,
          invokeBuiltinTool: (def, args) =>
            invokeSkillRunSatelliteTool(def, args, agentToolCtx, skill),
        });

        const invokeSatelliteToolByName = async (
          name: string,
          args: Record<string, unknown>,
        ): Promise<string> => {
          const def = toolDefByName.get(name);
          if (!def) {
            return JSON.stringify({ error: `Tool not available: ${name}` });
          }
          const out = await invokeHubTool(def, args);
          return typeof out === 'string' ? out : JSON.stringify(out);
        };

        let llmResponses: string[] = [];
        const result = await executeSkill({
          skill,
          userPrompt: userMessage,
          workspaceRoot,
          runHooks: params.runHooks !== false,
          systemPromptOverride,
          satelliteTools,
          invokeTool: invokeSatelliteToolByName,
          maxIterations: Number(params.maxIterations ?? 10),
          agent: {
            async run({ systemPrompt, userMessage: userMsg, invokeTool, maxIterations }) {
              const agentResult = await deps.ai!.runAgent(
                {
                  model,
                  systemPrompt,
                  userMessage: userMsg,
                  tools: toolDefs,
                  maxIterations: maxIterations ?? 10,
                  timeoutMs,
                  invokeTool: invokeHubTool,
                },
                {
                  executionId: ctx.executionId ?? '',
                  workflowId: ctx.workflowId ?? '',
                  nodeId,
                  environment: 'test',
                  sessionId: ctx.sessionId,
                  onStream: ctx.onAgentStream,
                  modelNodeId: satellites.model!.id,
                  onSatelliteStream: ctx.onSatelliteStream,
                },
              );
              const json = agentResult.items[0]?.json ?? {};
              llmResponses = Array.isArray(json.llmResponses)
                ? json.llmResponses.filter(
                    (t): t is string => typeof t === 'string' && t.trim().length > 0,
                  )
                : [];
              return { text: String(json.answer ?? '') };
            },
          },
        });

        outputRow.push({
          json: {
            answer: result.text,
            skillId: skill.id,
            ...(llmResponses.length > 0 ? { llmResponses } : {}),
          },
        });
      }

      return {
        status: 'success',
        outputItems: [outputRow],
      };
    },
  };
}
