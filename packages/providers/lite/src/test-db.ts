import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applySchema } from "./drizzle/apply-schema.js";
import * as schema from "./drizzle/schema.js";
import type { LiteDatabase } from "./db.js";

export async function createTestDb(): Promise<LiteDatabase> {
  const sqlite = new Database(":memory:");
  applySchema(sqlite);
  return drizzle(sqlite, { schema });
}
