export interface ScheduleDueItem {
  workflowId: string;
  cron: string;
  timezone?: string;
}

export interface SchedulerServiceDeps {
  holderId: string;
  tryAcquireLease(now: Date): Promise<boolean>;
  releaseLease(): Promise<void>;
  listDueSchedules(now: Date): Promise<ScheduleDueItem[]>;
  enqueueSchedule(input: ScheduleDueItem & { triggerType: 'schedule' }): Promise<void>;
}

export function createSchedulerService(deps: SchedulerServiceDeps) {
  return {
    async tick(now: Date): Promise<{ enqueued: number }> {
      if (!(await deps.tryAcquireLease(now))) {
        return { enqueued: 0 };
      }
      try {
        const due = await deps.listDueSchedules(now);
        for (const item of due) {
          await deps.enqueueSchedule({
            ...item,
            triggerType: 'schedule',
          });
        }
        return { enqueued: due.length };
      } finally {
        await deps.releaseLease();
      }
    },
  };
}
