import type { WorkflowTemplateIR } from './workflow-template-ir.js';

export interface CompiledWorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
}

export interface CompiledWorkflowConnection {
  from: string;
  to: string;
  fromOutput?: string;
  toInput?: string;
}

export interface CompiledWorkflowDefinition {
  schemaVersion: 1;
  name: string;
  nodes: CompiledWorkflowNode[];
  connections: CompiledWorkflowConnection[];
  meta?: Record<string, unknown>;
}

export type WorkflowCompileMode = 'linear_skillRun' | 'subagent_satellite';

export interface WorkflowCompilerOptions {
  compileMode?: WorkflowCompileMode;
  origin?: { x: number; y: number };
  workspaceRootTemplate?: string;
}

export class WorkflowCompiler {
  compile(
    template: WorkflowTemplateIR,
    options: WorkflowCompilerOptions = {},
  ): CompiledWorkflowDefinition {
    const mode = options.compileMode ?? 'linear_skillRun';
    if (mode !== 'linear_skillRun') {
      throw new Error(`Unsupported compileMode: ${mode}`);
    }
    return compileLinearSkillRun(template, options);
  }
}

const ROLE_DISPLAY: Record<string, string> = {
  product_manager: 'PM',
  full_stack_engineer: 'Engineer',
  qa_engineer: 'QA',
  devops: 'DevOps',
};

const HITL_NAME: Record<string, string> = {
  'pm-spec': 'Approve PM spec',
};

function compileLinearSkillRun(
  template: WorkflowTemplateIR,
  options: WorkflowCompilerOptions,
): CompiledWorkflowDefinition {
  const origin = options.origin ?? { x: 80, y: 120 };
  const workspaceRoot = options.workspaceRootTemplate ?? '{{$workspaceRoot}}';
  const nodes: CompiledWorkflowNode[] = [];
  const connections: CompiledWorkflowConnection[] = [];

  nodes.push({
    id: 'wf-trigger',
    type: 'manualTrigger',
    name: 'Start',
    position: { x: origin.x, y: origin.y },
    parameters: {},
  });

  nodes.push({
    id: 'wf-chat-model',
    type: 'aiChatModel',
    name: 'Chat Model',
    position: { x: origin.x, y: origin.y + 160 },
    parameters: { provider: 'ollama', model: 'llama3' },
  });

  let prevId = 'wf-trigger';
  let x = origin.x + 280;

  for (const step of template.steps) {
    const skillNodeId = `wf-${step.id}`;
    const roleLabel = step.agentRole
      ? (ROLE_DISPLAY[step.agentRole] ??
        step.agentRole
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '))
      : step.skillRef;
    nodes.push({
      id: skillNodeId,
      type: 'skillRun',
      name: `${roleLabel} — ${step.skillRef}`,
      position: { x, y: origin.y },
      parameters: {
        skillSource: 'path',
        skillPath: step.skillRef,
        ...(step.promptTemplate ? { prompt: step.promptTemplate } : {}),
        ...(step.agentRole ? { agentRoleHint: step.agentRole } : {}),
        workspaceRoot,
      },
    });
    connections.push({ from: prevId, to: skillNodeId });
    connections.push({
      from: 'wf-chat-model',
      to: skillNodeId,
      toInput: 'ai_languageModel',
    });
    prevId = skillNodeId;
    x += 280;

    if (step.gate?.type === 'human_approval') {
      const hitlId = `wf-hitl-${step.id}`;
      nodes.push({
        id: hitlId,
        type: 'humanApproval',
        name: HITL_NAME[step.id] ?? `Approve ${step.id}`,
        position: { x, y: origin.y },
        parameters: {
          prompt: `请审批步骤 ${step.id} 产出后继续（Antigravity：直至 Approved）`,
          allowReject: true,
          hitlLoopOnReject: step.gate.onReject === 'loop',
        },
      });
      connections.push({ from: skillNodeId, to: hitlId });
      prevId = hitlId;
      x += 280;
    }
  }

  return {
    schemaVersion: 1,
    name: template.name,
    nodes,
    connections,
    meta: {
      source: `rxwf/workflow/${template.id}`,
      templateId: template.id,
      compileMode: 'linear_skillRun',
      compileVersion: 1,
      provenance: template.provenance ?? 'antigravity',
      pendingHitlLoop: template.steps.some((s) => s.gate?.onReject === 'loop'),
      warnings: [],
    },
  };
}
