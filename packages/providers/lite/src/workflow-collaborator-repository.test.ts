import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-db.js";
import { createWorkflowCollaboratorRepository } from "./workflow-collaborator-repository.js";
import { workflows as workflowsTable, users as usersTable } from "./drizzle/schema.js";

async function insertUser(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id: string,
  email: string,
) {
  await db.insert(usersTable).values({
    id,
    email,
    passwordHash: "hash",
    role: "member",
    status: "active",
    createdAt: new Date(),
  });
}

async function insertWorkflow(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id: string,
  createdByUserId: string,
) {
  const now = new Date();
  await db.insert(workflowsTable).values({
    id,
    name: "Test Flow",
    status: "draft",
    createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
}

describe("createWorkflowCollaboratorRepository", () => {
  it("lists collaborators and resolves effective role", async () => {
    const db = await createTestDb();
    const repo = createWorkflowCollaboratorRepository(db);
    const creatorUserId = "creator-1";
    const editorUserId = "editor-1";
    const workflowId = "wf-1";

    await insertUser(db, creatorUserId, "creator@x.com");
    await insertUser(db, editorUserId, "editor@x.com");
    await insertWorkflow(db, workflowId, creatorUserId);
    await repo.upsert(workflowId, editorUserId, "editor");

    const collaborators = await repo.list(workflowId);
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0]).toMatchObject({
      userId: editorUserId,
      email: "editor@x.com",
      role: "editor",
    });

    const role = await repo.getEffectiveRole(workflowId, editorUserId, creatorUserId);
    expect(role).toBe("editor");

    const creatorRole = await repo.getEffectiveRole(workflowId, creatorUserId, creatorUserId);
    expect(creatorRole).toBe("owner");
  });

  it("upserts collaborator role and removes collaborator", async () => {
    const db = await createTestDb();
    const repo = createWorkflowCollaboratorRepository(db);
    const creatorUserId = "creator-2";
    const viewerUserId = "viewer-1";
    const workflowId = "wf-2";

    await insertUser(db, creatorUserId, "creator2@x.com");
    await insertUser(db, viewerUserId, "viewer@x.com");
    await insertWorkflow(db, workflowId, creatorUserId);

    await repo.upsert(workflowId, viewerUserId, "viewer");
    await repo.upsert(workflowId, viewerUserId, "editor");

    expect(await repo.list(workflowId)).toMatchObject([{ role: "editor" }]);

    await repo.remove(workflowId, viewerUserId);
    expect(await repo.list(workflowId)).toHaveLength(0);
    expect(await repo.getEffectiveRole(workflowId, viewerUserId, creatorUserId)).toBeNull();
  });

  it("lists workflow ids by scope", async () => {
    const db = await createTestDb();
    const repo = createWorkflowCollaboratorRepository(db);
    const creatorUserId = "creator-3";
    const collaboratorUserId = "collab-1";

    await insertUser(db, creatorUserId, "creator3@x.com");
    await insertUser(db, collaboratorUserId, "collab@x.com");
    await insertWorkflow(db, "mine-wf", creatorUserId);
    await insertWorkflow(db, "shared-wf", creatorUserId);
    await repo.upsert("shared-wf", collaboratorUserId, "viewer");

    expect(await repo.listWorkflowIdsForUser(creatorUserId, "mine")).toEqual([
      "mine-wf",
      "shared-wf",
    ]);
    expect(await repo.listWorkflowIdsForUser(collaboratorUserId, "shared")).toEqual(["shared-wf"]);
    expect(await repo.listWorkflowIdsForUser(creatorUserId, "all")).toEqual(
      expect.arrayContaining(["mine-wf", "shared-wf"]),
    );
  });
});
