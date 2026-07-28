export type LiteRole = "admin" | "member";

export function canView(role: LiteRole): boolean {
  return role === "admin" || role === "member";
}

export function canEdit(role: LiteRole): boolean {
  return role === "admin" || role === "member";
}

export function canExecute(role: LiteRole): boolean {
  return role === "admin" || role === "member";
}

export function canManageSystem(role: LiteRole): boolean {
  return role === "admin";
}

export type SystemRole = "admin" | "member";
export type WorkflowRole = "owner" | "editor" | "viewer";

export function isSystemAdmin(role: SystemRole): boolean {
  return role === "admin";
}

const WORKFLOW_RANK: Record<WorkflowRole, number> = { owner: 3, editor: 2, viewer: 1 };

export function workflowRoleRank(role: WorkflowRole): number {
  return WORKFLOW_RANK[role];
}

export function canViewWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role !== null;
}

export function canEditWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role === "owner" || role === "editor";
}

export function canShareWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role === "owner" || role === "editor";
}

export function canManageCollaborators(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return canShareWorkflow(role, isAdmin);
}
