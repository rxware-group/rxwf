import { describe, it, expect } from 'vitest';
import { createLiteSchedulerLease } from './scheduler-lease.js';
import { createTestDb } from './test-db.js';

describe('createLiteSchedulerLease', () => {
  it('allows holder to acquire when lease expired', async () => {
    const db = await createTestDb();
    const lease = createLiteSchedulerLease(db, 'holder-a');
    const past = new Date('2026-05-20T09:00:00Z');
    expect(await lease.tryAcquireLease(past)).toBe(true);
    expect(await lease.releaseLease()).toBeUndefined();
    const now = new Date('2026-05-20T10:00:00Z');
    expect(await lease.tryAcquireLease(now)).toBe(true);
  });

  it('denies acquire when another holder holds a valid lease', async () => {
    const db = await createTestDb();
    const leaseA = createLiteSchedulerLease(db, 'holder-a');
    const leaseB = createLiteSchedulerLease(db, 'holder-b');
    const now = new Date('2026-05-20T10:00:00Z');
    expect(await leaseA.tryAcquireLease(now)).toBe(true);
    expect(await leaseB.tryAcquireLease(now)).toBe(false);
  });
});
