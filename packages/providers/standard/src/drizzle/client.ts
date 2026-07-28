import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { applyPgSchema } from './apply-schema.js';

const { Pool } = pg;

export type StandardDatabase = ReturnType<typeof drizzle<typeof schema>>;

export async function createStandardPool(connectionString: string): Promise<pg.Pool> {
  const pool = new Pool({ connectionString });
  await applyPgSchema(pool);
  return pool;
}

export function createStandardDb(pool: pg.Pool): StandardDatabase {
  return drizzle(pool, { schema });
}

export async function openStandardDatabase(
  connectionString: string,
): Promise<{ pool: pg.Pool; db: StandardDatabase }> {
  const pool = await createStandardPool(connectionString);
  return { pool, db: createStandardDb(pool) };
}
