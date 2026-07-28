import { eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { schedulerLeases } from './drizzle/schema.js';

const LEASE_ROW_ID = 'scheduler';
const LEASE_TTL_MS = 90_000;

export function createLiteSchedulerLease(db: LiteDatabase, holderId: string) {
  return {
    async tryAcquireLease(now: Date): Promise<boolean> {
      const leaseUntil = new Date(now.getTime() + LEASE_TTL_MS);
      const rows = await db
        .select()
        .from(schedulerLeases)
        .where(eq(schedulerLeases.id, LEASE_ROW_ID))
        .limit(1);
      const existing = rows[0];

      if (!existing) {
        await db.insert(schedulerLeases).values({
          id: LEASE_ROW_ID,
          holder: holderId,
          leaseUntil,
          updatedAt: now,
        });
        return true;
      }

      if (existing.leaseUntil <= now || existing.holder === holderId) {
        await db
          .update(schedulerLeases)
          .set({
            holder: holderId,
            leaseUntil,
            updatedAt: now,
          })
          .where(eq(schedulerLeases.id, LEASE_ROW_ID));
        return true;
      }

      return false;
    },

    async releaseLease(): Promise<void> {
      const now = new Date();
      await db
        .update(schedulerLeases)
        .set({ leaseUntil: now, updatedAt: now })
        .where(eq(schedulerLeases.id, LEASE_ROW_ID));
    },
  };
}
