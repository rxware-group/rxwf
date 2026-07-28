import { describe, it, expect } from 'vitest';
import type { WorkflowDefinition } from '@rxwf/workflow';
import { listDueSchedules } from './list-due-schedules.js';

function scheduleWorkflow(
  workflowId: string,
  cron: string,
  timezone = 'UTC',
): { workflowId: string; definition: WorkflowDefinition } {
  return {
    workflowId,
    definition: {
      schemaVersion: 1,
      name: 'Scheduled',
      active: true,
      settings: { timezone },
      nodes: [
        {
          id: 'sched-1',
          type: 'scheduleTrigger',
          name: 'Every day 10:00',
          position: { x: 0, y: 0 },
          parameters: { cron },
        },
      ],
      connections: [],
    },
  };
}

describe('listDueSchedules', () => {
  it('returns active workflows whose scheduleTrigger cron is due', () => {
    const now = new Date('2026-05-20T10:00:15.000Z');
    const due = listDueSchedules(now, [
      scheduleWorkflow('wf-due', '0 10 * * *'),
      scheduleWorkflow('wf-later', '0 11 * * *'),
    ]);
    expect(due).toEqual([
      { workflowId: 'wf-due', cron: '0 10 * * *', timezone: 'UTC' },
    ]);
  });

  it('skips workflows without scheduleTrigger nodes', () => {
    const now = new Date('2026-05-20T10:00:00.000Z');
    const due = listDueSchedules(now, [
      {
        workflowId: 'wf-manual',
        definition: {
          schemaVersion: 1,
          name: 'Manual only',
          nodes: [
            {
              id: 't1',
              type: 'manualTrigger',
              name: 'Start',
              position: { x: 0, y: 0 },
              parameters: {},
            },
          ],
          connections: [],
        },
      },
    ]);
    expect(due).toEqual([]);
  });
});
