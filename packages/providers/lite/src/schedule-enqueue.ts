import type { LiteDatabase } from './db.js';
import { createLiteExecutionJobEnqueue } from './execution-job-enqueue.js';

export interface ScheduleEnqueueInput {
  workflowId: string;
  cron: string;
  timezone?: string;
  triggerType: 'schedule';
}

export function createLiteScheduleEnqueue(db: LiteDatabase) {
  const jobEnqueue = createLiteExecutionJobEnqueue(db);
  return {
    async enqueueSchedule(input: ScheduleEnqueueInput): Promise<void> {
      await jobEnqueue.enqueueExecutionJob({
        workflowId: input.workflowId,
        triggerType: 'schedule',
        mode: 'production',
      });
    },
  };
}
