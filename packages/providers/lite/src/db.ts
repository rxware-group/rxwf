import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "./drizzle/schema.js";

export type LiteDatabase = BetterSQLite3Database<typeof schema>;
