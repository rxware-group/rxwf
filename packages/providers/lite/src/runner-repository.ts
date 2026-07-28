import type {
  RunnerPlatform,
  RunnerRecord,
  RunnerRegistrationInput,
  RunnerRepositoryPort,
} from "@rxwf/providers-contracts";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { LiteDatabase } from "./db.js";
import { runners } from "./drizzle/schema.js";

type RunnerRow = typeof runners.$inferSelect;

function parseJsonArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is string => typeof item === "string");
}

function hashCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

function toRunnerRecord(row: RunnerRow): RunnerRecord {
  const labels = parseJsonArray(row.labels);
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as RunnerRecord["kind"],
    platform: {
      os: row.platformOs as RunnerPlatform["os"],
      arch: row.platformArch as RunnerPlatform["arch"],
      ...(row.platformVersion ? { osVersion: row.platformVersion } : {}),
    },
    status: row.status as RunnerRecord["status"],
    capabilities: parseJsonArray(row.capabilities),
    maxConcurrent: row.maxConcurrent,
    runningJobs: row.runningJobs,
    ...(labels.length > 0 ? { labels } : {}),
    ...(row.agentVersion ? { agentVersion: row.agentVersion } : {}),
    ...(row.lastHeartbeatAt ? { lastHeartbeatAt: row.lastHeartbeatAt } : {}),
  };
}

export function createLiteRunnerRepository(
  db: LiteDatabase,
): RunnerRepositoryPort {
  return {
    async ensureEmbedded(
      platform: RunnerPlatform,
      capabilities: string[],
    ): Promise<RunnerRecord> {
      const existing = await db
        .select()
        .from(runners)
        .where(eq(runners.kind, "embedded"))
        .limit(1);

      if (existing[0]) {
        return toRunnerRecord(existing[0]);
      }

      const now = new Date();
      const id = crypto.randomUUID();
      const row: typeof runners.$inferInsert = {
        id,
        name: "Embedded Runner",
        kind: "embedded",
        platformOs: platform.os,
        platformArch: platform.arch,
        platformVersion: platform.osVersion ?? null,
        labels: "[]",
        capabilities: JSON.stringify(capabilities),
        status: "online",
        maxConcurrent: 10,
        runningJobs: 0,
        credentialHash: "",
        registeredAt: now,
      };

      await db.insert(runners).values(row);
      const inserted = await db
        .select()
        .from(runners)
        .where(eq(runners.id, id))
        .limit(1);

      if (!inserted[0]) {
        throw new Error("Failed to create embedded runner");
      }

      return toRunnerRecord(inserted[0]);
    },

    async listOnline(filter?: { kind?: string }): Promise<RunnerRecord[]> {
      const conditions = [eq(runners.status, "online")];
      if (filter?.kind) {
        conditions.push(eq(runners.kind, filter.kind));
      }

      const rows = await db
        .select()
        .from(runners)
        .where(and(...conditions));

      return rows.map(toRunnerRecord);
    },

    async listAll(): Promise<RunnerRecord[]> {
      const rows = await db.select().from(runners);
      return rows.map(toRunnerRecord);
    },

    async findById(id: string): Promise<RunnerRecord | null> {
      const rows = await db
        .select()
        .from(runners)
        .where(eq(runners.id, id))
        .limit(1);

      return rows[0] ? toRunnerRecord(rows[0]) : null;
    },

    async incrementRunningJobs(id: string, delta: number): Promise<void> {
      await db
        .update(runners)
        .set({
          runningJobs: sql`${runners.runningJobs} + ${delta}`,
        })
        .where(eq(runners.id, id));
    },

    async registerAgent(
      input: RunnerRegistrationInput,
      credentialHash: string,
    ): Promise<RunnerRecord> {
      const now = new Date();
      const id = crypto.randomUUID();
      const row: typeof runners.$inferInsert = {
        id,
        name: input.name,
        kind: "agent",
        platformOs: input.platform.os,
        platformArch: input.platform.arch,
        platformVersion: input.platform.osVersion ?? null,
        labels: JSON.stringify(input.labels ?? []),
        capabilities: JSON.stringify(input.capabilities),
        status: "offline",
        maxConcurrent: input.maxConcurrent ?? 2,
        runningJobs: 0,
        agentVersion: input.agentVersion ?? null,
        credentialHash,
        registeredAt: now,
      };

      await db.insert(runners).values(row);
      const inserted = await db
        .select()
        .from(runners)
        .where(eq(runners.id, id))
        .limit(1);

      if (!inserted[0]) {
        throw new Error("Failed to register agent runner");
      }

      return toRunnerRecord(inserted[0]);
    },

    async verifyCredential(
      runnerId: string,
      credential: string,
    ): Promise<boolean> {
      const rows = await db
        .select({ credentialHash: runners.credentialHash })
        .from(runners)
        .where(eq(runners.id, runnerId))
        .limit(1);

      const stored = rows[0];
      if (!stored) {
        return false;
      }

      return hashCredential(credential) === stored.credentialHash;
    },

    async updatePresence(
      runnerId: string,
      runningJobs: number,
    ): Promise<void> {
      await db
        .update(runners)
        .set({
          runningJobs,
          lastHeartbeatAt: new Date(),
        })
        .where(eq(runners.id, runnerId));
    },

    async setStatus(
      runnerId: string,
      status: RunnerRecord["status"],
    ): Promise<void> {
      await db
        .update(runners)
        .set({ status })
        .where(eq(runners.id, runnerId));
    },

    async revokeAgent(runnerId: string): Promise<void> {
      await db
        .delete(runners)
        .where(and(eq(runners.id, runnerId), eq(runners.kind, "agent")));
    },

    async rotateCredential(runnerId: string, newHash: string): Promise<void> {
      await db
        .update(runners)
        .set({ credentialHash: newHash })
        .where(eq(runners.id, runnerId));
    },
  };
}
