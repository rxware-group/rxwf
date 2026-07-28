import type { FastifyInstance } from 'fastify';
import type { LiteDatabase } from '@rxwf/providers-lite';
import { liteSchema } from '@rxwf/providers-lite';
import { count } from 'drizzle-orm';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { envDefaults } from '../config.js';

export function registerSetupRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  getRuntimeConfig?: () => Promise<RuntimeConfig>,
): void {
  app.get('/api/setup/checklist', async () => {
    const runtime = getRuntimeConfig
      ? await getRuntimeConfig()
      : { publicUrl: envDefaults.publicUrl };
    const userRows = await db.select({ c: count() }).from(liteSchema.users);
    const runnerRows = await db.select({ c: count() }).from(liteSchema.runners);
    const userCount = userRows[0]?.c ?? 0;
    const runnerCount = runnerRows[0]?.c ?? 0;
    const items = [
      { id: 'database', label: 'Database initialized', done: true },
      { id: 'admin', label: 'Admin user exists', done: userCount > 0 },
      { id: 'embedded_runner', label: 'Embedded runner registered', done: runnerCount > 0 },
      { id: 'public_url', label: 'Public URL configured', done: Boolean(runtime.publicUrl) },
    ];
    return {
      complete: items.every((i) => i.done),
      items,
    };
  });
}
