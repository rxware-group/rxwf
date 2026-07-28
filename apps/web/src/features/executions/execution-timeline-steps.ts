import type { AgentStepRecord, ExecutionNodeRun } from '../../api/client.js';
import { t, type LabelMap } from '../../i18n/labels.js';

export type TimelineEntryKind = 'tool' | 'token' | 'orchestrator' | 'worker' | 'summary';

export interface TimelineEntry {
  key: string;
  kind: TimelineEntryKind;
  status: 'running' | 'success' | 'failed';
  label: string;
  detail?: string;
}

export interface NodeTimeline {
  title: string;
  entries: TimelineEntry[];
  finalAnswer?: string;
}

export interface CrewOutputJson {
  answer?: string;
  process?: string;
  crewSteps?: Array<{
    nodeId: string;
    role: string;
    name: string;
    answer: string;
    task?: string;
    delegatedBy?: string;
  }>;
  supervisorSteps?: Array<{
    step: number;
    decision: Record<string, unknown>;
  }>;
  agentSteps?: AgentStepRecord[];
}

export function extractCrewOutputJson(nr: ExecutionNodeRun): CrewOutputJson | undefined {
  const output = nr.outputData as unknown[][] | null | undefined;
  const first = output?.[0]?.[0] as { json?: CrewOutputJson } | undefined;
  const json = first?.json;
  if (!json || typeof json !== 'object') return undefined;
  if (
    json.crewSteps ||
    json.supervisorSteps ||
    json.process ||
    json.agentSteps
  ) {
    return json;
  }
  return undefined;
}

export function resolveAgentSteps(nr: ExecutionNodeRun): AgentStepRecord[] | undefined {
  const fromMeta = nr.metadata?.agentSteps;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta;

  const output = extractCrewOutputJson(nr);
  if (Array.isArray(output?.agentSteps) && output.agentSteps.length > 0) {
    return output.agentSteps;
  }

  const raw = nr.outputData as unknown[][] | null | undefined;
  const firstJson = raw?.[0]?.[0] as { json?: { agentSteps?: AgentStepRecord[] } } | undefined;
  const fromOutput = firstJson?.json?.agentSteps;
  return Array.isArray(fromOutput) && fromOutput.length > 0 ? fromOutput : undefined;
}

export function timelineTitle(
  labels: LabelMap,
  nodeType: string | undefined,
  output?: CrewOutputJson,
): string {
  const process = output?.process;
  if (process === 'supervisor') return t(labels, 'timeline.supervisor');
  if (process === 'hierarchical') return t(labels, 'timeline.hierarchical');
  if (process === 'sequential') return t(labels, 'timeline.sequential');
  switch (nodeType) {
    case 'crewSupervisor':
      return t(labels, 'timeline.supervisor');
    case 'crewHierarchical':
      return t(labels, 'timeline.hierarchical');
    case 'crewSequential':
      return t(labels, 'timeline.sequential');
    case 'aiAgent':
      return t(labels, 'timeline.agentSteps');
    default:
      return t(labels, 'timeline.execSteps');
  }
}

export function formatCrewDecision(labels: LabelMap, decision: unknown): string {
  if (!decision || typeof decision !== 'object') return t(labels, 'timeline.unknownDecision');
  const d = decision as Record<string, unknown>;
  const action = String(d.action ?? '');
  if (action === 'finish') {
    const answer = String(d.answer ?? '').trim();
    return answer
      ? t(labels, 'timeline.finishWithAnswer', { answer: truncate(answer, 120) })
      : t(labels, 'timeline.finish');
  }
  if (action === 'delegate' || action === 'run') {
    const member = String(d.member ?? '?');
    const task = String(d.task ?? '').trim();
    return task
      ? t(labels, 'timeline.delegateWithTask', {
          member,
          task: truncate(task, 80),
        })
      : t(labels, 'timeline.delegate', { member });
  }
  if (action === 'delegate_parallel' || action === 'run_parallel') {
    const assignments = d.assignments;
    const n = Array.isArray(assignments) ? assignments.length : 0;
    return t(labels, 'timeline.parallelRun', { n: String(n) });
  }
  return action || t(labels, 'timeline.decision');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function agentStepToEntry(
  labels: LabelMap,
  step: AgentStepRecord,
  idx: number,
): TimelineEntry | null {
  if (step.type === 'tool' || step.tool) {
    const tool = step.tool ?? 'tool';
    const duration = step.durationMs != null ? ` (${step.durationMs}ms)` : '';
    return {
      key: `tool-${idx}`,
      kind: 'tool',
      status: step.status,
      label: `${tool} — ${step.status}${duration}`,
    };
  }
  if (step.type === 'token' && step.content) {
    return {
      key: `token-${idx}`,
      kind: 'token',
      status: step.status,
      label: `token — ${step.status}`,
      detail: truncate(step.content, 200),
    };
  }
  if (step.type === 'agent_step' && step.output && typeof step.output === 'object') {
    const o = step.output as Record<string, unknown>;
    if (o.crewManager != null || o.supervisor != null) {
      const who = String(o.crewManager ?? o.supervisor ?? t(labels, 'auto.t_eefdd05b'));
      const round =
        o.round != null
          ? t(labels, 'timeline.round', { n: String(Number(o.round) + 1) })
          : o.stepIndex != null
            ? t(labels, 'timeline.step', { n: String(Number(o.stepIndex) + 1) })
            : undefined;
      return {
        key: `orch-${idx}`,
        kind: 'orchestrator',
        status: 'success',
        label: [who, formatCrewDecision(labels, o.decision), round].filter(Boolean).join(' · '),
      };
    }
    if (o.crewMember != null) {
      const name = String(o.crewMember);
      const status = String(o.status ?? 'success');
      const task = o.task != null ? String(o.task) : undefined;
      if (status === 'running') {
        return {
          key: `worker-${idx}-run`,
          kind: 'worker',
          status: 'running',
          label: t(labels, 'timeline.running', { name }),
          detail: task ? truncate(task, 120) : undefined,
        };
      }
      const outputText =
        o.output != null ? truncate(String(o.output), 160) : undefined;
      return {
        key: `worker-${idx}`,
        kind: 'worker',
        status: status === 'failed' ? 'failed' : 'success',
        label:
          status === 'success'
            ? t(labels, 'timeline.done', { name })
            : t(labels, 'timeline.failed', { name, status }),
        detail: outputText ?? (task ? truncate(task, 120) : undefined),
      };
    }
  }
  if (step.tool) {
    return {
      key: `step-${idx}`,
      kind: 'tool',
      status: step.status,
      label: String(step.tool),
    };
  }
  return null;
}

export function buildTimelineFromAgentSteps(
  labels: LabelMap,
  steps: AgentStepRecord[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < steps.length; i++) {
    const entry = agentStepToEntry(labels, steps[i]!, i);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function buildTimelineFromCrewOutput(
  labels: LabelMap,
  output: CrewOutputJson,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let idx = 0;

  if (output.supervisorSteps?.length) {
    for (const row of output.supervisorSteps) {
      entries.push({
        key: `sup-${idx++}`,
        kind: 'orchestrator',
        status: 'success',
        label: t(labels, 'timeline.supervise', {
          step: String(row.step + 1),
          decision: formatCrewDecision(labels, row.decision),
        }),
      });
    }
  }

  if (output.crewSteps?.length) {
    for (const row of output.crewSteps) {
      const by = row.delegatedBy
        ? t(labels, 'timeline.delegatedBy', { by: row.delegatedBy })
        : '';
      entries.push({
        key: `crew-${idx++}`,
        kind: 'worker',
        status: 'success',
        label: `${row.name} · ${row.role}${by}`,
        detail: row.task
          ? truncate(row.task, 100)
          : row.answer
            ? truncate(row.answer, 160)
            : undefined,
      });
    }
  }

  return entries;
}

export function resolveNodeTimeline(labels: LabelMap, nr: ExecutionNodeRun): NodeTimeline | null {
  const output = extractCrewOutputJson(nr);
  const agentSteps = resolveAgentSteps(nr);

  let entries: TimelineEntry[] = [];
  if (agentSteps?.length) {
    entries = buildTimelineFromAgentSteps(labels, agentSteps);
  } else if (output && (output.crewSteps?.length || output.supervisorSteps?.length)) {
    entries = buildTimelineFromCrewOutput(labels, output);
  }

  if (entries.length === 0) return null;

  const finalAnswer = output?.answer?.trim();
  if (finalAnswer) {
    entries.push({
      key: 'final-answer',
      kind: 'summary',
      status: 'success',
      label: t(labels, 'timeline.finalOutput'),
      detail: truncate(finalAnswer, 240),
    });
  }

  return {
    title: timelineTitle(labels, nr.nodeType, output),
    entries,
    finalAnswer,
  };
}
