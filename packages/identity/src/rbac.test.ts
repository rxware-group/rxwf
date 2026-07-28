import { describe, it, expect } from "vitest";
import {
  workflowRoleRank,
  canEditWorkflow,
  canShareWorkflow,
} from "./rbac.js";

describe("workflow RBAC", () => {
  it("owner can share, viewer cannot edit", () => {
    expect(canShareWorkflow("owner", false)).toBe(true);
    expect(canShareWorkflow("viewer", false)).toBe(false);
    expect(canEditWorkflow("editor", false)).toBe(true);
    expect(canEditWorkflow("viewer", false)).toBe(false);
  });

  it("ranks owner > editor > viewer", () => {
    expect(workflowRoleRank("owner")).toBeGreaterThan(workflowRoleRank("editor"));
    expect(workflowRoleRank("editor")).toBeGreaterThan(workflowRoleRank("viewer"));
  });

  it("admin bypasses workflow role checks", () => {
    expect(canEditWorkflow(null, true)).toBe(true);
    expect(canShareWorkflow(null, true)).toBe(true);
  });
});
