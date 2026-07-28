import { describe, it, expect } from 'vitest';
import {
  createSchedulerService,
  listDueSchedules,
} from '@rxwf/execution';
import {
  createPublishedScheduleWorkflowLoader,
  createLiteScheduleEnqueue,
  createLiteSchedulerLease,
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createUserService } from '@rxwf/identity';

const jobsTable = liteSchema.jobs;

describe('scheduler lite wiring', () => {
  it('tick enqueues job for active workflow with due scheduleTrigger', async () => {
    const db = await createTestDb();
    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    const publishUserId = (await createUserService(db).createUser({ email: `u-${crypto.randomUUID()}@example.com`, password: 'secret1234', role: 'admin' })).id;
    const created = await workflows.create({
      name: 'Cron Flow',
      definition: {
        schemaVersion: 1,
        name: 'Cron Flow',
        active: true,
        settings: { timezone: 'UTC' },
        nodes: [
          {
            id: 'sched-1',
            type: 'scheduleTrigger',
            name: 'Daily 10:00',
            position: { x: 0, y: 0 },
            parameters: { cron: '0 10 * * *' },
          },
        ],
        connections: [],
      },
    });
    await workflows.publish(created.id, publishUserId);

    const lease = createLiteSchedulerLease(db, 'test-holder');
    const loadPublished = createPublishedScheduleWorkflowLoader(db);
    const enqueue = createLiteScheduleEnqueue(db);
    const scheduler = createSchedulerService({
      holderId: 'test-holder',
      tryAcquireLease: (now) => lease.tryAcquireLease(now),
      releaseLease: () => lease.releaseLease(),
      listDueSchedules: async (now) => {
        const rows = await loadPublished.listPublishedWithDefinitions();
        return listDueSchedules(now, rows);
      },
      enqueueSchedule: (item) => enqueue.enqueueSchedule(item),
    });

    const now = new Date('2026-05-20T10:00:05.000Z');
    const result = await scheduler.tick(now);
    expect(result.enqueued).toBe(1);

    const jobs = await db.select().from(jobsTable);
    expect(jobs[0]?.kind).toBe('execution.enqueue');
    const payload = JSON.parse(jobs[0]!.payload) as {
      workflowId: string;
      triggerType: string;
    };
    expect(payload.triggerType).toBe('schedule');
    expect(payload.workflowId).toBe(created.id);
  });
});
