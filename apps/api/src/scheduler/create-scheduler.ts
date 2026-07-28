import {
  createSchedulerService,
  listDueSchedules,
} from '@rxwf/execution';
import type { LiteDatabase } from '@rxwf/providers-lite';
import {
  createPublishedScheduleWorkflowLoader,
  createLiteExecutionJobEnqueue,
  createLiteSchedulerLease,
} from '@rxwf/providers-lite';
import { startSchedulerLoop } from './scheduler-loop.js';

export interface StartApiSchedulerOptions {
  db: LiteDatabase;
  holderId: string;
  intervalMs?: number;
}

export function startApiScheduler(options: StartApiSchedulerOptions): {
  stop: () => void;
} {
  const intervalMs = options.intervalMs ?? 60_000;
  const lease = createLiteSchedulerLease(options.db, options.holderId);
  const loadPublished = createPublishedScheduleWorkflowLoader(options.db);
  const jobEnqueue = createLiteExecutionJobEnqueue(options.db);
  const scheduler = createSchedulerService({
    holderId: options.holderId,
    tryAcquireLease: (now) => lease.tryAcquireLease(now),
    releaseLease: () => lease.releaseLease(),
    listDueSchedules: async (now) => {
      const workflows = await loadPublished.listPublishedWithDefinitions();
      return listDueSchedules(now, workflows);
    },
    enqueueSchedule: (item) =>
      jobEnqueue.enqueueExecutionJob({
        workflowId: item.workflowId,
        triggerType: 'schedule',
        mode: 'production',
      }),
  });

  return startSchedulerLoop({
    intervalMs,
    tick: async () => {
      await scheduler.tick(new Date());
    },
  });
}
