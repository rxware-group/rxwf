import { describe, expect, it } from 'vitest';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import type { AgentStepRecord, ExecutionNodeRun } from '../../api/client.js';
import {
  buildTimelineFromAgentSteps,
  buildTimelineFromCrewOutput,
  formatCrewDecision,
  resolveNodeTimeline,
} from './execution-timeline-steps.js';

const labels = getLocaleBundle('zh-CN');

describe('formatCrewDecision', () => {
  it('formats run and finish actions', () => {
    expect(
      formatCrewDecision(labels, { action: 'run', member: 'Researcher', task: 'analyze' }),
    ).toContain('Researcher');
    expect(formatCrewDecision(labels, { action: 'finish', answer: 'done' })).toContain(
      labels['timeline.finish'] ?? '完成',
    );
  });
});

describe('buildTimelineFromAgentSteps', () => {
  it('maps supervisor stream steps', () => {
    const steps: AgentStepRecord[] = [
      {
        type: 'agent_step',
        status: 'success',
        output: {
          supervisor: 'Supervisor',
          stepIndex: 0,
          decision: { action: 'run', member: 'W1', task: 'go' },
        },
      },
      {
        type: 'agent_step',
        status: 'success',
        output: { crewMember: 'W1', status: 'running', task: 'go' },
      },
      {
        type: 'agent_step',
        status: 'success',
        output: { crewMember: 'W1', status: 'success', output: 'ok' },
      },
    ];
    const entries = buildTimelineFromAgentSteps(labels, steps);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.kind).toBe('orchestrator');
    expect(entries[1]?.status).toBe('running');
    expect(entries[2]?.label).toContain(labels['timeline.finish'] ?? '完成');
  });
});

describe('buildTimelineFromCrewOutput', () => {
  it('builds from supervisorSteps and crewSteps', () => {
    const entries = buildTimelineFromCrewOutput(labels, {
      process: 'supervisor',
      supervisorSteps: [
        { step: 0, decision: { action: 'run', member: 'A', task: 't' } },
      ],
      crewSteps: [{ nodeId: 'w1', role: 'R', name: 'A', answer: 'out', task: 't' }],
      answer: 'final',
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]?.kind).toBe('orchestrator');
    expect(entries.some((e) => e.kind === 'worker')).toBe(true);
  });
});

describe('resolveNodeTimeline', () => {
  it('prefers metadata agentSteps over output crewSteps', () => {
    const nr: ExecutionNodeRun = {
      nodeId: 'sup',
      nodeType: 'crewSupervisor',
      status: 'success',
      metadata: {
        agentSteps: [
          {
            type: 'agent_step',
            status: 'success',
            output: { supervisor: 'S', stepIndex: 0, decision: { action: 'finish', answer: 'x' } },
          },
        ],
      },
      outputData: [
        [
          {
            json: {
              process: 'supervisor',
              crewSteps: [{ nodeId: 'w', role: 'R', name: 'W', answer: 'a' }],
              answer: 'final',
            },
          },
        ],
      ],
    };
    const timeline = resolveNodeTimeline(labels, nr);
    expect(timeline?.title).toContain('Supervisor');
    expect(timeline?.entries[0]?.kind).toBe('orchestrator');
    expect(timeline?.entries.some((e) => e.kind === 'summary')).toBe(true);
  });
});
