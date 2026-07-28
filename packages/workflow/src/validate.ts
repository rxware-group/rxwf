import { validateWorkflowExpressionSources } from '@rxwf/expression';
import { collectSatellites, isSatelliteNodeType } from './agent-satellites.js';
import {
  validateSkillRunNodes,
  validateToolSubagentNodes,
  validateWorkflowRunNodes,
} from './validate-skill.js';
import { collectCrewManager, collectCrewMembers, collectCrewWorkers } from './crew-members.js';
import {
  collectGroupMembers,
  collectGroupOrchestrator,
} from './group-members.js';
import {
  resolveEffectiveRunnerPolicy,
  type NodeRunnerOverride,
  type RunnerPolicy,
} from './runner-policy.js';
import { validateSubworkflowTriggerLayout } from './subworkflow-trigger-schema.js';
import { hasDisallowedWorkflowCycle } from './graph-cycle.js';

const TOOL_SATELLITE_TYPES = new Set(['toolMcp', 'toolHttp', 'toolWorkflow']);

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  disabled?: boolean;
  runner?: NodeRunnerOverride;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  fromOutput?: string;
  toInput?: string;
  outputIndex?: number;
}

export interface WorkflowDefinition {
  schemaVersion: 1;
  name: string;
  active?: boolean;
  settings?: {
    timezone?: string;
    runnerPolicy?: RunnerPolicy;
    errorWorkflowId?: string;
    exposeAsTool?: boolean;
    exposeAsToolDescription?: string;
    /** `agent` = 独立 Agent 画布（范式 B）；默认 `automation` */
    workflowKind?: 'automation' | 'agent';
    /** Web search provider config for skillRun builtin (P1) */
    webSearch?: Record<string, unknown>;
    /** Max nested toolSubagent / toolSkill depth (P2, default 2) */
    maxAgentDepth?: number;
    /** Allow skillRun toolIntentMode=auto (Editor+ workflow setting, P3) */
    skillToolIntentAuto?: boolean;
    /** When false, editor hides Crew / group-chat resource ports and palette entries. */
    enableCrew?: boolean;
  };
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}

export type ValidateResult =
  | { ok: true; warnings: ValidationError[] }
  | { ok: false; errors: ValidationError[]; warnings: ValidationError[] };

export interface ValidateOptions {
  subworkflowDepth?: number;
  errorWorkflowDepth?: number;
  /** When false, crew nodes with executionBackend 'crewai' fail E1040 */
  crewaiRunnerConfigured?: boolean;
  allowedCrewaiBuiltinTools?: string[];
  /** When provided, pinned runnerId is checked for existence (warning only). */
  knownRunnerIds?: readonly string[];
}

const CREW_NODE_TYPES = new Set(['crewSequential', 'crewHierarchical', 'crewSupervisor']);

function isCrewaiExecutionBackend(parameters: Record<string, unknown>): boolean {
  return parameters.executionBackend === 'crewai';
}

function parseEnableBuiltinTools(parameters: Record<string, unknown>): string[] {
  if (!Array.isArray(parameters.enableBuiltinTools)) return [];
  return parameters.enableBuiltinTools.filter((t): t is string => typeof t === 'string');
}

function memberHasToolSatellite(
  definition: WorkflowDefinition,
  memberId: string,
): boolean {
  const satellites = collectSatellites(definition, memberId);
  return satellites.tools.some((t) => TOOL_SATELLITE_TYPES.has(t.type));
}

const MAX_SUBWORKFLOW_DEPTH = 5;
const MAX_ERROR_WORKFLOW_DEPTH = 2;
const NODE_WARN_THRESHOLD = 200;

function hasCycle(nodes: WorkflowNode[], connections: WorkflowConnection[]): boolean {
  return hasDisallowedWorkflowCycle(nodes, connections);
}

function hasNonEmptyLabels(labels: unknown): boolean {
  return (
    Array.isArray(labels) &&
    labels.some((label) => typeof label === 'string' && label.trim().length > 0)
  );
}

function validateRunnerPolicyShape(
  policy: { mode?: string; runnerId?: string; labels?: unknown },
  errors: ValidationError[],
  messagePrefix: string,
  nodeId?: string,
): void {
  if (policy.mode === 'pinned') {
    const runnerId = typeof policy.runnerId === 'string' ? policy.runnerId.trim() : '';
    if (!runnerId) {
      errors.push({
        code: 'E1015',
        message: `${messagePrefix}: pinned mode requires runnerId`,
        ...(nodeId ? { nodeId } : {}),
      });
    }
  }
  if (policy.mode === 'label' && !hasNonEmptyLabels(policy.labels)) {
    errors.push({
      code: 'E1016',
      message: `${messagePrefix}: label mode requires non-empty labels`,
      ...(nodeId ? { nodeId } : {}),
    });
  }
}

function warnUnknownPinnedRunner(
  policy: { mode?: string; runnerId?: string },
  warnings: ValidationError[],
  knownRunnerIds: readonly string[] | undefined,
  messagePrefix: string,
): void {
  if (!knownRunnerIds || policy.mode !== 'pinned') return;
  const runnerId = typeof policy.runnerId === 'string' ? policy.runnerId.trim() : '';
  if (!runnerId) return;
  const known = new Set(knownRunnerIds);
  if (!known.has(runnerId)) {
    warnings.push({
      code: 'E1010',
      message: `${messagePrefix}: runner ${runnerId} does not exist`,
    });
  }
}

function nodeRequiresEmbeddedFallbackError(
  node: WorkflowNode,
  workflowRunnerPolicy: RunnerPolicy | undefined,
): ValidationError | null {
  if (node.parameters.preferRemote !== true) return null;

  const effective = resolveEffectiveRunnerPolicy({
    nodeRunner: node.runner,
    workflowRunnerPolicy,
  });
  const fallback =
    effective.fallback ?? workflowRunnerPolicy?.fallback ?? 'embedded';

  if (effective.mode === 'embedded' || fallback === 'embedded') {
    return {
      code: 'E1005',
      message: `Node ${node.name} requires remote runner and cannot use embedded fallback`,
      nodeId: node.id,
    };
  }
  return null;
}

export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
  options: ValidateOptions = {},
): ValidateResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (definition.nodes.length > NODE_WARN_THRESHOLD) {
    warnings.push({
      code: 'E1004',
      message: `Node count ${definition.nodes.length} exceeds recommended limit of ${NODE_WARN_THRESHOLD}`,
    });
  }

  const subDepth = options.subworkflowDepth ?? 0;
  const hasSubworkflow = definition.nodes.some((n) => n.type === 'executeWorkflow');
  if (hasSubworkflow && subDepth >= MAX_SUBWORKFLOW_DEPTH) {
    errors.push({
      code: 'E1003',
      message: 'Subworkflow nesting depth exceeds maximum of 5',
    });
  }

  const errorDepth = options.errorWorkflowDepth ?? 0;
  if (errorDepth >= MAX_ERROR_WORKFLOW_DEPTH) {
    errors.push({
      code: 'E1004',
      message: 'Error workflow recursion depth exceeds maximum of 2',
    });
  }

  const workflowRunnerPolicy = definition.settings?.runnerPolicy;
  if (workflowRunnerPolicy) {
    validateRunnerPolicyShape(
      workflowRunnerPolicy,
      errors,
      'Workflow runner policy',
    );
    warnUnknownPinnedRunner(
      workflowRunnerPolicy,
      warnings,
      options.knownRunnerIds,
      'Workflow runner policy',
    );
  }

  for (const node of definition.nodes) {
    const nodeRunner = node.runner;
    if (nodeRunner && nodeRunner.mode !== 'inherit') {
      validateRunnerPolicyShape(
        nodeRunner,
        errors,
        `Node ${node.name} runner override`,
        node.id,
      );
      warnUnknownPinnedRunner(
        nodeRunner,
        warnings,
        options.knownRunnerIds,
        `Node ${node.name} runner override`,
      );
    }

    const preferRemoteError = nodeRequiresEmbeddedFallbackError(node, workflowRunnerPolicy);
    if (preferRemoteError) errors.push(preferRemoteError);
  }

  const executableNodes = definition.nodes.filter((n) => n.type !== 'stickyNote');
  const noteIds = new Set(
    definition.nodes.filter((n) => n.type === 'stickyNote').map((n) => n.id),
  );
  const executableConnections = definition.connections.filter(
    (c) => !noteIds.has(c.from) && !noteIds.has(c.to),
  );

  const seenNames = new Map<string, string>();
  for (const node of executableNodes) {
    const trimmed = node.name.trim();
    if (!trimmed) {
      errors.push({
        code: 'E1002',
        message: 'Node name must not be empty',
        nodeId: node.id,
      });
      continue;
    }
    const prev = seenNames.get(trimmed);
    if (prev) {
      errors.push({
        code: 'E1006',
        message: `Duplicate node name: ${trimmed}`,
        nodeId: node.id,
      });
    } else {
      seenNames.set(trimmed, node.id);
    }
  }

  if (hasCycle(executableNodes, executableConnections)) {
    errors.push({
      code: 'E1003',
      message: 'Workflow contains cyclic connections',
    });
  }

  for (const node of definition.nodes) {
    if (node.type !== 'aiAgent') continue;
    const satellites = collectSatellites(definition, node.id);

    const modelLinks = definition.connections.filter(
      (c) => c.to === node.id && (c.toInput ?? 'main') === 'ai_languageModel',
    );
    if (modelLinks.length > 1) {
      errors.push({
        code: 'E1014',
        message: 'AI Agent must connect to exactly one Chat Model',
        nodeId: node.id,
      });
    } else if (!satellites.model) {
      errors.push({
        code: 'E1012',
        message: 'AI Agent requires a connected Chat Model (ai_languageModel)',
        nodeId: node.id,
      });
    }

    const memoryLinks = definition.connections.filter(
      (c) => c.to === node.id && (c.toInput ?? 'main') === 'ai_memory',
    );
    if (memoryLinks.length > 1) {
      errors.push({
        code: 'E1014',
        message: 'AI Agent must connect to at most one Memory node',
        nodeId: node.id,
      });
    }

    const knowledgeLinks = definition.connections.filter(
      (c) => c.to === node.id && (c.toInput ?? 'main') === 'ai_knowledge',
    );
    if (knowledgeLinks.length > 1) {
      errors.push({
        code: 'E1014',
        message: 'AI Agent must connect to at most one Knowledge node',
        nodeId: node.id,
      });
    }

    const outputParserLinks = definition.connections.filter(
      (c) => c.to === node.id && (c.toInput ?? 'main') === 'ai_outputParser',
    );
    if (outputParserLinks.length > 1) {
      errors.push({
        code: 'E1014',
        message: 'AI Agent must connect to at most one Output Parser node',
        nodeId: node.id,
      });
    }

    // Tool satellites optional (0~n): pure chat when none; ReAct when ≥1 connected.
  }

  for (const node of definition.nodes) {
    if (node.type === 'crewSequential') {
      const members = collectCrewMembers(definition, node.id);
      if (members.length < 2) {
        errors.push({
          code: 'E1030',
          message: 'Crew Sequential requires at least two connected aiAgent members',
          nodeId: node.id,
        });
      }
      for (const member of members) {
        if (!String(member.parameters.role ?? '').trim()) {
          warnings.push({
            code: 'W1012',
            message: `Crew member ${member.name} has no role configured`,
            nodeId: member.id,
          });
        }
      }
    }
    if (node.type === 'crewSupervisor') {
      const workers = collectCrewWorkers(definition, node.id);
      if (workers.length < 1) {
        errors.push({
          code: 'E1032',
          message: 'Crew Supervisor requires at least one worker aiAgent on crew_member port',
          nodeId: node.id,
        });
      }
      const manager = collectCrewManager(definition, node.id);
      const hasInlineModel = Boolean(String(node.parameters.supervisorModel ?? '').trim());
      const managerHasModel =
        manager &&
        definition.connections.some(
          (c) => c.to === manager.id && (c.toInput ?? 'main') === 'ai_languageModel',
        );
      if (!hasInlineModel && !managerHasModel) {
        errors.push({
          code: 'E1035',
          message:
            'Crew Supervisor requires supervisorModel or crew_manager with Chat Model',
          nodeId: node.id,
        });
      }
    }
    if (node.type === 'crewHierarchical') {
      const manager = collectCrewManager(definition, node.id);
      if (!manager) {
        errors.push({
          code: 'E1031',
          message: 'Crew Hierarchical requires a manager aiAgent on crew_manager port',
          nodeId: node.id,
        });
      }
      const workers = collectCrewWorkers(
        definition,
        node.id,
        manager ? { excludeNodeId: manager.id } : undefined,
      );
      if (workers.length < 1) {
        errors.push({
          code: 'E1032',
          message: 'Crew Hierarchical requires at least one worker aiAgent on crew_member port',
          nodeId: node.id,
        });
      }
      for (const member of workers) {
        if (!String(member.parameters.role ?? '').trim()) {
          warnings.push({
            code: 'W1012',
            message: `Crew worker ${member.name} has no role configured`,
            nodeId: member.id,
          });
        }
      }
    }
    if (node.type === 'groupChat') {
      const members = collectGroupMembers(definition, node.id);
      if (members.length < 2) {
        errors.push({
          code: 'E1048',
          message: 'Group Chat requires at least two connected aiAgent members on group_member',
          nodeId: node.id,
        });
      }
      for (const member of members) {
        const satellites = collectSatellites(definition, member.id);
        if (!satellites.model) {
          errors.push({
            code: 'E1012',
            message: `Group Chat member ${member.name} requires a connected Chat Model`,
            nodeId: member.id,
          });
        }
        if (!String(member.parameters.role ?? '').trim()) {
          warnings.push({
            code: 'W1012',
            message: `Group Chat member ${member.name} has no role configured`,
            nodeId: member.id,
          });
        }
      }
      if (String(node.parameters.speakerSelection ?? 'roundRobin') === 'orchestrator') {
        const orchestratorAgent = collectGroupOrchestrator(definition, node.id);
        const hasInlineModel = Boolean(String(node.parameters.orchestratorModel ?? '').trim());
        const orchestratorHasModel =
          orchestratorAgent &&
          definition.connections.some(
            (c) =>
              c.to === orchestratorAgent.id &&
              (c.toInput ?? 'main') === 'ai_languageModel',
          );
        if (!hasInlineModel && !orchestratorHasModel) {
          errors.push({
            code: 'E1049',
            message:
              'Group Chat orchestrator mode requires orchestratorModel or group_orchestrator Agent with Chat Model',
            nodeId: node.id,
          });
        }
      }
    }
  }

  for (const node of definition.nodes) {
    if (!CREW_NODE_TYPES.has(node.type)) continue;
    if (!isCrewaiExecutionBackend(node.parameters)) continue;

    if (options.crewaiRunnerConfigured !== true) {
      errors.push({
        code: 'E1040',
        message:
          'CrewAI execution backend requires a configured CrewAI runner (CREWAI_RUNNER_URL)',
        nodeId: node.id,
      });
    }

    const allowedBuiltin = options.allowedCrewaiBuiltinTools;
    if (allowedBuiltin) {
      const allowedSet = new Set(allowedBuiltin);
      for (const toolName of parseEnableBuiltinTools(node.parameters)) {
        if (!allowedSet.has(toolName)) {
          errors.push({
            code: 'E1041',
            message: `CrewAI builtin tool not allowed: ${toolName}`,
            nodeId: node.id,
          });
        }
      }
    }

    if (node.parameters.crewaiProcess === 'consensual') {
      errors.push({
        code: 'E1046',
        message: 'CrewAI consensual process is not yet supported by the sidecar',
        nodeId: node.id,
      });
    }

    if (node.parameters.crewaiFlowMode === 'flow' && node.type !== 'crewSequential') {
      warnings.push({
        code: 'W1014',
        message: 'CrewAI flow mode is only fully supported for crewSequential in P4-D3',
        nodeId: node.id,
      });
    }

    const members =
      node.type === 'crewSequential'
        ? collectCrewMembers(definition, node.id)
        : collectCrewWorkers(
            definition,
            node.id,
            node.type === 'crewHierarchical'
              ? {
                  excludeNodeId:
                    collectCrewManager(definition, node.id)?.id ?? undefined,
                }
              : undefined,
          );
    const hasBuiltinTools = parseEnableBuiltinTools(node.parameters).length > 0;
    const anyMemberHasTools = members.some((m) =>
      memberHasToolSatellite(definition, m.id),
    );
    if (!anyMemberHasTools && !hasBuiltinTools) {
      warnings.push({
        code: 'W1013',
        message:
          'CrewAI backend: crew members have no tools and no builtin tools enabled',
        nodeId: node.id,
      });
    }
  }

  for (const node of definition.nodes) {
    if (node.type !== 'loop') continue;
    const loopOut0 = definition.connections.some(
      (c) => c.from === node.id && (c.fromOutput ?? 'main') === '0',
    );
    const loopOut1 = definition.connections.some(
      (c) => c.from === node.id && (c.fromOutput ?? 'main') === '1',
    );
    if (!loopOut0) {
      errors.push({
        code: 'E2002',
        message: `Loop node ${node.name} has no loop body (connect output "loop")`,
        nodeId: node.id,
      });
    }
    if (!loopOut1) {
      warnings.push({
        code: 'W1020',
        message: `Loop node ${node.name} has no done output connected`,
        nodeId: node.id,
      });
    }
  }

  validateSkillRunNodes(definition, errors);
  validateToolSubagentNodes(definition, errors);
  validateWorkflowRunNodes(definition, errors);

  for (const issue of validateWorkflowExpressionSources(
    definition.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      parameters: n.parameters,
    })),
  )) {
    errors.push({
      code: 'E1002',
      message: `${issue.nodeName}: ${issue.fieldPath} — ${issue.message}`,
      nodeId: issue.nodeId,
    });
  }

  const agentLikeInputs = new Set([
    'ai_languageModel',
    'ai_memory',
    'ai_knowledge',
    'ai_outputParser',
    'ai_tool',
    'ai_instruction',
  ]);

  for (const node of definition.nodes) {
    if (!isSatelliteNodeType(node.type)) continue;
    const linkedToAgent = definition.connections.some(
      (c) => c.from === node.id && agentLikeInputs.has(c.toInput ?? ''),
    );
    if (!linkedToAgent) {
      warnings.push({
        code: 'W1010',
        message: `Satellite node ${node.name} is not connected to an AI Agent or skillRun`,
        nodeId: node.id,
      });
    }
  }

  for (const issue of validateSubworkflowTriggerLayout(definition)) {
    errors.push({
      code: issue.code,
      message: issue.message,
      nodeId: issue.nodeId,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, warnings };
}
