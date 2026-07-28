import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { ToolDefinition, ModelRef } from '@rxwf/ai-runtime-stub';
import {
  formatPathOutsideScanRootsMessage,
  type RunnerToolInvokeRequest,
  type RunnerToolInvokeResult,
  type WebSearchProviderConfig,
} from '@rxwf/runner-protocol';
import type { RunnerGatewayPort, WebSearchPort } from '@rxwf/providers-contracts';
import {
  hasInputMappingOverride,
  type ResolvedSubworkflowInputSchema,
  type WorkflowNode,
} from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import {
  buildJsonSchemaFromFromAiSpecs,
  collectFromAiSpecsFromToolParams,
  parseAgentStructuredOutput,
} from '@rxwf/expression';
import { resolveSatelliteToolDescription } from './builtin-satellite-tool-description.js';
import { subagentToolDefinition } from './run-subagent-tool.js';
import { skillToolDefinition } from './run-skill-tool.js';

/** Resolve LLM config from an `aiChatModel` satellite node's parameters. */
export function modelFromChatModelNode(params: Record<string, unknown>): ModelRef {
  return {
    provider: String(params.provider ?? 'ollama'),
    model: String(params.model ?? 'llama3'),
    baseUrl: params.baseUrl ? String(params.baseUrl) : undefined,
    credentialId: params.credentialId ? String(params.credentialId) : undefined,
  };
}

export interface ResolvedToolRunner {
  kind: 'embedded' | 'agent';
  id?: string;
}

export interface AgentToolInvokeContext {
  scanRoots: string[];
  executionId?: string;
  nodeRunId?: string;
  runnerGateway?: RunnerGatewayPort;
  resolveRunnerForToolNode?: (toolNodeId: string) => Promise<ResolvedToolRunner | undefined>;
  resolveWebSearchProviderConfig?: (toolNodeId: string) => Promise<WebSearchProviderConfig | undefined>;
  webSearch?: WebSearchPort;
}

function toolParametersFromNode(params: Record<string, unknown>): Record<string, unknown> {
  const specs = collectFromAiSpecsFromToolParams(params);
  return buildJsonSchemaFromFromAiSpecs(specs);
}

export interface BuildAgentToolDefinitionsOptions {
  childWorkflowSchemas?: Map<string, ResolvedSubworkflowInputSchema>;
  /** UI locale for built-in fixed-capability tool descriptions (e.g. zh-CN, en-US). */
  locale?: string;
}

/** Extract JSON Schema from `aiOutputParser` satellite parameters. */
export function outputSchemaFromParserNode(parser: WorkflowNode): Record<string, unknown> | undefined {
  const raw = parser.parameters.jsonSchema;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Parse agent answer against connected `aiOutputParser` schema (throws E3013 on failure). */
export function parseOutputParserAnswer(
  answer: string,
  parserNode: WorkflowNode,
): Record<string, unknown> {
  const schema = outputSchemaFromParserNode(parserNode);
  if (!schema) {
    throw new AwfError('E3013', 'Output Parser requires valid jsonSchema');
  }
  return parseAgentStructuredOutput(answer, schema);
}

function toolWorkflowParameters(
  params: Record<string, unknown>,
  childSchema: ResolvedSubworkflowInputSchema | undefined,
): Record<string, unknown> {
  if (hasInputMappingOverride(params)) {
    return toolParametersFromNode(params);
  }
  if (childSchema) {
    return childSchema.jsonSchema;
  }
  return toolParametersFromNode(params);
}

function isInsideRoots(target: string, scanRoots: string[]): boolean {
  const normalized = target.replace(/\\/g, '/');
  return scanRoots.some((root) => {
    const r = root.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === r || normalized.startsWith(`${r}/`);
  });
}

async function resolveWithinRoots(
  path: string,
  scanRoots: string[],
): Promise<string | null> {
  try {
    const abs = resolve(path);
    const rp = await realpath(abs);
    if (!isInsideRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    return null;
  }
}

const DEFAULT_GREP_MAX_RESULTS = 50;

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

async function resolveWritePath(path: string, scanRoots: string[]): Promise<string | null> {
  const abs = resolve(path);
  try {
    const rp = await realpath(abs);
    if (!isInsideRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    const parent = dirname(abs);
    try {
      const parentRp = await realpath(parent);
      if (!isInsideScanRoots(parentRp, scanRoots)) return null;
      if (!isInsideRoots(abs, scanRoots)) return null;
      return abs;
    } catch {
      if (!isInsideRoots(abs, scanRoots)) return null;
      return abs;
    }
  }
}

function isInsideScanRoots(target: string, scanRoots: string[]): boolean {
  return isInsideRoots(target, scanRoots);
}

async function invokeEmbeddedRunnerTool(
  request: RunnerToolInvokeRequest,
): Promise<RunnerToolInvokeResult> {
  const started = Date.now();
  const fail = (errorCode: string, errorMessage: string): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'failed',
    errorCode,
    errorMessage,
    durationMs: Date.now() - started,
  });

  if (request.capability === 'skill:filesystem') {
    const method = request.method;
    const args = request.args;
    if (method === 'read') {
      const path = String(args.path ?? '');
      const scanRoots = request.scanRoots ?? [];
      const resolved = await resolveWithinRoots(path, scanRoots);
      if (!resolved) {
        return fail('E1056', formatPathOutsideScanRootsMessage(scanRoots, { path }));
      }
      try {
        const content = await readFile(resolved, 'utf8');
        return {
          invokeId: request.invokeId,
          status: 'success',
          result: content,
          durationMs: Date.now() - started,
        };
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
      const scanRoots = request.scanRoots ?? [];
      const resolved = await resolveWritePath(path, scanRoots);
      if (!resolved) {
        return fail('E1056', formatPathOutsideScanRootsMessage(scanRoots, { path }));
      }
      try {
        await mkdir(dirname(resolved), { recursive: true });
        if (args.append === true) {
          await appendFile(resolved, content, 'utf8');
        } else {
          await writeFile(resolved, content, 'utf8');
        }
        return {
          invokeId: request.invokeId,
          status: 'success',
          result: {
            path: resolved,
            bytesWritten: Buffer.byteLength(content, 'utf8'),
          },
          durationMs: Date.now() - started,
        };
      } catch (e) {
        return fail('E1041', e instanceof Error ? e.message : String(e));
      }
    }
    if (method === 'grep') {
      const pattern = String(args.pattern ?? '').trim();
      if (!pattern) {
        return fail('E2002', 'grep pattern is required');
      }
      const scanRoots = request.scanRoots ?? [];
      const startPath = args.path ? String(args.path) : scanRoots[0] ?? '.';
      const glob = args.glob ? String(args.glob) : undefined;
      if (args.path) {
        const resolved = await resolveWithinRoots(startPath, scanRoots);
        if (!resolved) {
          return fail('E1056', formatPathOutsideScanRootsMessage(scanRoots, { path: startPath }));
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
        const resolvedStart = await resolveWithinRoots(startPath, scanRoots);
        if (!resolvedStart) {
          return fail('E1056', formatPathOutsideScanRootsMessage(scanRoots, { path: startPath }));
        }
        const info = await stat(resolvedStart);
        if (info.isFile()) {
          if (matchesGrepGlob(resolvedStart.split(/[/\\]/).pop() ?? '', glob)) {
            await searchFile(resolvedStart);
          }
        } else if (info.isDirectory()) {
          await walk(resolvedStart);
        }
        return {
          invokeId: request.invokeId,
          status: 'success',
          result: { matches, grepFallback: true },
          durationMs: Date.now() - started,
        };
      } catch (e) {
        return fail('E1041', e instanceof Error ? e.message : String(e));
      }
    }
    return fail('E2002', `Unknown filesystem method: ${method}`);
  }

  if (request.capability === 'shell' && request.method === 'exec') {
    return fail('E1057', 'Shell not enabled in embedded tool invoke v1');
  }

  return fail('E2002', `Unknown capability: ${request.capability}`);
}

async function dispatchRunnerToolInvoke(
  request: RunnerToolInvokeRequest,
  ctx: AgentToolInvokeContext,
  toolNodeId: string,
): Promise<unknown> {
  const resolved = ctx.resolveRunnerForToolNode
    ? await ctx.resolveRunnerForToolNode(toolNodeId)
    : { kind: 'embedded' as const };

  let result: RunnerToolInvokeResult;
  if (resolved?.kind === 'agent' && resolved.id && ctx.runnerGateway) {
    result = await ctx.runnerGateway.invokeTool(resolved.id, request, {
      timeoutMs: request.timeoutMs,
    });
  } else {
    result = await invokeEmbeddedRunnerTool(request);
  }

  if (result.status !== 'success') {
    throw new AwfError(
      result.errorCode ?? 'E1041',
      result.errorMessage ?? 'tool invoke failed',
    );
  }
  return result.result;
}

export function buildAgentToolDefinitions(
  toolNodes: WorkflowNode[],
  options: BuildAgentToolDefinitionsOptions = {},
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const toolNode of toolNodes) {
    const p = toolNode.parameters;
    const description = resolveSatelliteToolDescription(toolNode.type, p, options.locale);
    if (!description) {
      throw new AwfError('E2003', `Tool node ${toolNode.name} requires toolDescription`);
    }
    const name = toolNode.name.trim();
    let parameters = toolParametersFromNode(p);

    if (toolNode.type === 'toolRead') {
      tools.push({
        name,
        description,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path under workspace' },
            target_file: { type: 'string', description: 'Alias for path' },
          },
        },
        source: { type: 'filesystem', operation: 'read', toolNodeId: toolNode.id },
      });
    } else if (toolNode.type === 'toolWrite') {
      tools.push({
        name,
        description,
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            append: { type: 'boolean' },
          },
          required: ['path', 'content'],
        },
        source: { type: 'filesystem', operation: 'write', toolNodeId: toolNode.id },
      });
    } else if (toolNode.type === 'toolGrep') {
      tools.push({
        name,
        description,
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' },
            glob: { type: 'string' },
          },
          required: ['pattern'],
        },
        source: { type: 'filesystem', operation: 'grep', toolNodeId: toolNode.id },
      });
    } else if (toolNode.type === 'toolShell') {
      tools.push({
        name,
        description,
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            cwd: { type: 'string' },
            timeoutMs: { type: 'number' },
          },
          required: ['command'],
        },
        source: { type: 'shell', toolNodeId: toolNode.id },
      });
    } else if (toolNode.type === 'toolWebSearch') {
      tools.push({
        name,
        description,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            q: { type: 'string' },
            maxResults: { type: 'number' },
          },
        },
        source: { type: 'web_search', toolNodeId: toolNode.id },
      });
    } else if (toolNode.type === 'toolMcp') {
      const toolNames = Array.isArray(p.tools)
        ? (p.tools as unknown[]).filter(
            (t): t is string => typeof t === 'string' && t.length > 0,
          )
        : [];
      const list = toolNames.length > 0 ? toolNames : ['list_directory'];
      for (const toolName of list) {
        tools.push({
          name: list.length > 1 ? `${name}_${toolName}` : name,
          description,
          parameters,
          source: {
            type: 'mcp',
            serverId: String(p.serverId ?? ''),
            toolName,
          },
        });
      }
    } else if (toolNode.type === 'toolHttp') {
      const headers =
        p.headers && typeof p.headers === 'object'
          ? (p.headers as Record<string, unknown>)
          : undefined;
      tools.push({
        name,
        description,
        parameters,
        source: {
          type: 'http',
          method: String(p.method ?? 'GET').toUpperCase(),
          url: String(p.url ?? ''),
          headers,
          body: p.body !== undefined ? String(p.body) : undefined,
        },
      });
    } else if (toolNode.type === 'toolWorkflow') {
      const workflowId = String(p.workflowId ?? '');
      parameters = toolWorkflowParameters(p, options.childWorkflowSchemas?.get(workflowId));
      tools.push({
        name,
        description,
        parameters,
        source: {
          type: 'workflow',
          workflowId,
        },
      });
    } else if (toolNode.type === 'toolSubagent') {
      tools.push(subagentToolDefinition(toolNode, p));
    } else if (toolNode.type === 'toolSkill') {
      tools.push(skillToolDefinition(toolNode, p));
    }
  }
  return tools;
}

export function isAgentSatelliteToolSource(source: ToolDefinition['source']): boolean {
  return (
    source.type === 'filesystem' ||
    source.type === 'shell' ||
    source.type === 'web_search'
  );
}

export async function invokeAgentTool(
  def: ToolDefinition,
  args: Record<string, unknown>,
  ctx: AgentToolInvokeContext,
): Promise<unknown> {
  const source = def.source;
  if (source.type === 'filesystem') {
    const method = source.operation;
    let invokeArgs: Record<string, unknown>;
    if (method === 'read') {
      invokeArgs = { path: String(args.path ?? args.target_file ?? '') };
    } else if (method === 'write') {
      invokeArgs = {
        path: String(args.path ?? ''),
        content: String(args.content ?? ''),
        append: args.append === true,
      };
    } else if (method === 'grep') {
      invokeArgs = {
        pattern: String(args.pattern ?? ''),
        ...(args.path ? { path: String(args.path) } : {}),
        ...(args.glob ? { glob: String(args.glob) } : {}),
      };
    } else {
      throw new AwfError('E3012', `Unsupported filesystem operation: ${method}`);
    }
    const request: RunnerToolInvokeRequest = {
      invokeId: randomUUID(),
      executionId: ctx.executionId ?? '',
      nodeRunId: ctx.nodeRunId ?? source.toolNodeId,
      capability: 'skill:filesystem',
      method,
      args: invokeArgs,
      scanRoots: ctx.scanRoots,
      timeoutMs: 60_000,
    };
    return dispatchRunnerToolInvoke(request, ctx, source.toolNodeId);
  }

  if (source.type === 'shell') {
    const request: RunnerToolInvokeRequest = {
      invokeId: randomUUID(),
      executionId: ctx.executionId ?? '',
      nodeRunId: ctx.nodeRunId ?? source.toolNodeId,
      capability: 'shell',
      method: 'exec',
      args: {
        command: String(args.command ?? ''),
        ...(args.cwd ? { cwd: String(args.cwd) } : {}),
        ...(args.timeoutMs !== undefined ? { timeoutMs: args.timeoutMs } : {}),
      },
      scanRoots: ctx.scanRoots,
      timeoutMs:
        typeof args.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : 60_000,
    };
    return dispatchRunnerToolInvoke(request, ctx, source.toolNodeId);
  }

  if (source.type === 'web_search') {
    const query = String(args.query ?? args.q ?? '').trim();
    if (!query) {
      throw new AwfError('E1071', 'web_search requires a non-empty query');
    }
    const resolved = ctx.resolveRunnerForToolNode
      ? await ctx.resolveRunnerForToolNode(source.toolNodeId)
      : { kind: 'embedded' as const };
    const timeoutMs = 60_000;

    if (resolved?.kind === 'agent' && resolved.id && ctx.runnerGateway) {
      const providerConfig = ctx.resolveWebSearchProviderConfig
        ? await ctx.resolveWebSearchProviderConfig(source.toolNodeId)
        : undefined;
      if (!providerConfig?.providerId) {
        throw new AwfError('E1071', 'Web search provider not configured');
      }
      const request: RunnerToolInvokeRequest = {
        invokeId: randomUUID(),
        executionId: ctx.executionId ?? '',
        nodeRunId: ctx.nodeRunId ?? source.toolNodeId,
        capability: 'web_search',
        method: 'search',
        args: {
          query,
          ...(typeof args.maxResults === 'number' ? { maxResults: args.maxResults } : {}),
        },
        providerConfig,
        timeoutMs,
      };
      const res = await ctx.runnerGateway.invokeTool(resolved.id, request, { timeoutMs });
      if (res.status !== 'success') {
        throw new AwfError(
          res.errorCode ?? 'E1074',
          res.errorMessage ?? 'web search failed',
        );
      }
      const result = res.result as { summary?: string } | undefined;
      return String(result?.summary ?? '');
    }

    if (!ctx.webSearch) {
      throw new AwfError('E1071', 'Web search provider not configured');
    }
    const result = await ctx.webSearch.search(
      { query },
      {
        maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
      },
    );
    return result.summary;
  }

  throw new AwfError('E3012', `invokeAgentTool: unsupported source type ${source.type}`);
}
