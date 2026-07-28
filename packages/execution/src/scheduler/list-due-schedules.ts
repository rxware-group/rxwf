import type { WorkflowDefinition } from '@rxwf/workflow';
import { isCronDue } from './is-cron-due.js';
import type { ScheduleDueItem } from './scheduler-service.js';

export function listDueSchedules(
  now: Date,
  workflows: Array<{ workflowId: string; definition: WorkflowDefinition }>,
): ScheduleDueItem[] {
  const due: ScheduleDueItem[] = [];

  for (const row of workflows) {
    const timezone =
      typeof row.definition.settings?.timezone === 'string'
        ? row.definition.settings.timezone
        : 'UTC';

    for (const node of row.definition.nodes) {
      if (node.type !== 'scheduleTrigger') continue;
      const cron = String(node.parameters.cron ?? '');
      if (!cron) continue;
      if (!isCronDue(cron, now, timezone)) continue;
      due.push({
        workflowId: row.workflowId,
        cron,
        timezone,
      });
    }
  }

  return due;
}
