import { describe, expect, it } from "vitest";
import {
  createTestDb,
  createLiteWorkflowRepository,
  createWorkflowCollaboratorRepository,
  liteSchema,
} from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";
import { createWorkflowAccessService } from "./workflow-access-service.js";
import type { AuthContext } from "./auth-service.js";

const { workflows: workflowsTable } = liteSchema;

function auth(userId: string, email: string, role: "admin" | "member"): AuthContext {
  return { userId, email, role, mustChangePassword: false, method: "session" };
}

async function insertWorkflow(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id: string,
  createdByUserId: string,
) {
  const now = new Date();
  await db.insert(workflowsTable).values({
    id,
    name: "Shared Flow",
    status: "draft",
    createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
}

describe("WorkflowAccessService", () => {
  it("allows owner to edit and denies viewer", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const workflowRepo = createLiteWorkflowRepository(db);
    const collaborators = createWorkflowCollaboratorRepository(db);

    const owner = await users.createUser({
      email: "owner@x.com",
      password: "password1234",
      role: "member",
    });
    const viewer = await users.createUser({
      email: "viewer@x.com",
      password: "password1234",
      role: "member",
    });
    const stranger = await users.createUser({
      email: "stranger@x.com",
      password: "password1234",
      role: "member",
    });

    const workflowId = "wf-access-1";
    await insertWorkflow(db, workflowId, owner.id);
    await collaborators.upsert(workflowId, viewer.id, "viewer");

    const access = createWorkflowAccessService({
      collaborators,
      getWorkflowMeta: async (id) => workflowRepo.getWorkflow(id),
    });

    await expect(
      access.assertCanEdit(workflowId, auth(owner.id, owner.email, "member")),
    ).resolves.toBeUndefined();
    await expect(
      access.assertCanView(workflowId, auth(viewer.id, viewer.email, "member")),
    ).resolves.toBeUndefined();
    await expect(
      access.assertCanEdit(workflowId, auth(viewer.id, viewer.email, "member")),
    ).rejects.toMatchObject({ code: "E4003" });
    await expect(
      access.assertCanView(workflowId, auth(stranger.id, stranger.email, "member")),
    ).rejects.toMatchObject({ code: "E4003" });
  });

  it("returns admin access for system admins", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const workflowRepo = createLiteWorkflowRepository(db);
    const collaborators = createWorkflowCollaboratorRepository(db);

    const owner = await users.createUser({
      email: "owner2@x.com",
      password: "password1234",
      role: "member",
    });
    const admin = await users.createUser({
      email: "admin@x.com",
      password: "password1234",
      role: "admin",
    });

    const workflowId = "wf-access-2";
    await insertWorkflow(db, workflowId, owner.id);

    const access = createWorkflowAccessService({
      collaborators,
      getWorkflowMeta: async (id) => workflowRepo.getWorkflow(id),
    });

    expect(await access.resolveAccess(workflowId, auth(admin.id, admin.email, "admin"))).toBe(
      "admin",
    );
    await expect(
      access.assertCanEdit(workflowId, auth(admin.id, admin.email, "admin")),
    ).resolves.toBeUndefined();
  });
});
