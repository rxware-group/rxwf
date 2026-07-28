import { collectCrewManager, collectSatellites } from '@rxwf/workflow';
import type { WorkflowDefinition, WorkflowNode } from '@rxwf/workflow';
import type { ModelRef } from '@rxwf/ai-runtime-stub';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
export interface CrewStepRecord {
  nodeId: string;
  role: string;
  name: string;
  answer: string;
  task?: string;
  delegatedBy?: string;
}

export function buildCrewRolePrompt(
  params: Record<string, unknown>,
  mode: 'sequential' | 'hierarchical' | 'supervisor' = 'sequential',
): string {
  const role = String(params.role ?? '').trim();
  const goal = String(params.goal ?? '').trim();
  const backstory = String(params.backstory ?? '').trim();
  const lines: string[] = [];
  if (role) lines.push(`Role: ${role}`);
  if (goal) lines.push(`Goal: ${goal}`);
  if (backstory) lines.push(`Backstory: ${backstory}`);
  if (lines.length === 0) return '';
  const intro =
    mode === 'supervisor'
      ? 'You are a crew worker assigned a task by the supervisor.'
      : mode === 'hierarchical'
        ? 'You are a crew worker assigned a task by the manager.'
        : 'You are a crew member in a sequential team.';
  return `${intro}\n${lines.join('\n')}`;
}

export function modelFromChatModelNode(params: Record<string, unknown>): ModelRef {
  return {
    provider: String(params.provider ?? 'ollama'),
    model: String(params.model ?? 'llama3'),
    baseUrl: params.baseUrl ? String(params.baseUrl) : undefined,
    credentialId: params.credentialId ? String(params.credentialId) : undefined,
  };
}

export interface CrewAssignment {
  member: string;
  task: string;
}

export type ManagerDecision =
  | { action: 'finish'; answer?: string }
  | { action: 'delegate'; member: string; task: string }
  | { action: 'delegate_parallel'; assignments: CrewAssignment[] };

function parseAssignments(raw: unknown): CrewAssignment[] {
  if (!Array.isArray(raw)) return [];
  const out: CrewAssignment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const member = String(row.member ?? '').trim();
    const task = String(row.task ?? '').trim();
    if (member && task) out.push({ member, task });
  }
  return out;
}

export function parseManagerDecision(raw: string): ManagerDecision | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = parsed.action;
    if (action === 'finish') {
      return {
        action: 'finish',
        answer: String(parsed.answer ?? '').trim(),
      };
    }
    if (action === 'delegate_parallel') {
      const assignments = parseAssignments(parsed.assignments);
      if (assignments.length === 0) return null;
      return { action: 'delegate_parallel', assignments };
    }
    if (action === 'delegate') {
      const member = String(parsed.member ?? '').trim();
      const task = String(parsed.task ?? '').trim();
      if (!member) return null;
      return { action: 'delegate', member, task };
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveWorkerByMemberKey(
  workers: WorkflowNode[],
  memberKey: string,
): WorkflowNode | null {
  const key = memberKey.trim().toLowerCase();
  if (!key) return null;
  return (
    workers.find((w) => w.id.toLowerCase() === key) ??
    workers.find((w) => w.name.trim().toLowerCase() === key) ??
    workers.find(
      (w) => String(w.parameters.role ?? '').trim().toLowerCase() === key,
    ) ??
    null
  );
}

export function buildOriginalTask(inputItems: { json: Record<string, unknown> }[]): string {
  if (inputItems.length === 0) return 'Complete the assigned task.';
  return JSON.stringify(inputItems.map((i) => i.json));
}

export async function askCrewManager(
  deps: PlusExecutorDeps,
  ctx: NodeExecutionContext,
  definition: WorkflowDefinition,
  manager: WorkflowNode,
  workers: WorkflowNode[],
  originalTask: string,
  steps: CrewStepRecord[],
  allowParallel = true,
): Promise<ManagerDecision> {
  if (!deps.ai) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }
  const satellites = collectSatellites(definition, manager.id);
  if (!satellites.model) {
    throw new AwfError('E3010', 'Crew manager has no connected Chat Model');
  }

  const roster = workers.map((w) => ({
    id: w.id,
    name: w.name,
    role: String(w.parameters.role ?? w.name),
    goal: String(w.parameters.goal ?? ''),
  }));

  const system = `You are a crew manager coordinating specialized workers.
Respond with ONLY one JSON object (no markdown).

To assign one worker:
{"action":"delegate","member":"<worker id, name, or role>","task":"<clear instruction>"}

${
  allowParallel
    ? `To assign multiple workers in parallel (same round):
{"action":"delegate_parallel","assignments":[{"member":"<id|name|role>","task":"<instruction>"}]}

`
    : ''
}When the overall task is complete:
{"action":"finish","answer":"<consolidated final answer>"}

Workers:
${JSON.stringify(roster, null, 2)}

Completed steps:
${JSON.stringify(steps, null, 2)}`;

  const user = `Original task:\n${originalTask}\n\nChoose the next action.`;

  let text = '';
  for await (const chunk of deps.ai.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model: modelFromChatModelNode(satellites.model.parameters) },
  )) {
    text += chunk;
  }

  const decision = parseManagerDecision(text);
  if (!decision) {
    throw new AwfError(
      'E1033',
      `Crew manager returned invalid JSON: ${text.slice(0, 200)}`,
    );
  }
  return decision;
}

export type SupervisorDecision =
  | { action: 'finish'; answer?: string }
  | { action: 'run'; member: string; task: string }
  | { action: 'run_parallel'; assignments: CrewAssignment[] };

export function parseSupervisorDecision(raw: string): SupervisorDecision | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = parsed.action;
    if (action === 'finish') {
      return { action: 'finish', answer: String(parsed.answer ?? '').trim() };
    }
    if (action === 'run_parallel' || action === 'delegate_parallel') {
      const assignments = parseAssignments(parsed.assignments);
      if (assignments.length === 0) return null;
      return { action: 'run_parallel', assignments };
    }
    if (action === 'run' || action === 'delegate') {
      const member = String(parsed.member ?? '').trim();
      const task = String(parsed.task ?? '').trim();
      if (!member) return null;
      return { action: 'run', member, task };
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveSupervisorModel(
  definition: WorkflowDefinition,
  crewNodeId: string,
  config: Record<string, unknown>,
): ModelRef {
  const manager = collectCrewManager(definition, crewNodeId);
  if (manager) {
    const satellites = collectSatellites(definition, manager.id);
    if (satellites.model) {
      return modelFromChatModelNode(satellites.model.parameters);
    }
  }
  const model = String(config.supervisorModel ?? '').trim();
  if (model) {
    const credentialId = String(config.supervisorCredentialId ?? '').trim();
    return {
      provider: String(config.supervisorProvider ?? 'ollama'),
      model,
      baseUrl: config.supervisorBaseUrl
        ? String(config.supervisorBaseUrl)
        : undefined,
      credentialId: credentialId || undefined,
    };
  }
  throw new AwfError(
    'E1035',
    'crewSupervisor requires crew_manager Chat Model or supervisorModel parameter',
  );
}

export async function askCrewSupervisor(
  deps: PlusExecutorDeps,
  model: ModelRef,
  workers: WorkflowNode[],
  originalTask: string,
  steps: CrewStepRecord[],
  stepIndex: number,
  allowParallel: boolean,
): Promise<SupervisorDecision> {
  if (!deps.ai) {
    throw new AwfError('E3001', 'AI runtime not configured');
  }

  const roster = workers.map((w) => ({
    id: w.id,
    name: w.name,
    role: String(w.parameters.role ?? w.name),
    goal: String(w.parameters.goal ?? ''),
    runsSoFar: steps.filter((s) => s.nodeId === w.id).length,
  }));

  const system = `You are a crew SUPERVISOR (dynamic orchestrator).
Each step, pick the best next action. You may call the same worker multiple times.
Respond with ONLY one JSON object (no markdown).

Run one worker:
{"action":"run","member":"<worker id, name, or role>","task":"<instruction>"}

${
  allowParallel
    ? `Run workers in parallel this step:
{"action":"run_parallel","assignments":[{"member":"<id|name|role>","task":"<instruction>"}]}

`
    : ''
}When done:
{"action":"finish","answer":"<final consolidated answer>"}

Roster (runsSoFar = times already executed):
${JSON.stringify(roster, null, 2)}

Completed steps:
${JSON.stringify(steps, null, 2)}`;

  const user = `Original task:\n${originalTask}\n\nSupervisor step ${stepIndex + 1}: choose next action.`;

  let text = '';
  for await (const chunk of deps.ai.chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model },
  )) {
    text += chunk;
  }

  const decision = parseSupervisorDecision(text);
  if (!decision) {
    throw new AwfError(
      'E1033',
      `Crew supervisor returned invalid JSON: ${text.slice(0, 200)}`,
    );
  }
  return decision;
}
