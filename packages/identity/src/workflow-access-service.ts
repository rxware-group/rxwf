import { AwfError } from "@rxwf/shared";
import type { WorkflowCollaboratorRepository } from "@rxwf/providers-lite";
import type { AuthContext } from "./auth-service.js";
import {
  canEditWorkflow,
  canShareWorkflow,
  canViewWorkflow,
  type WorkflowRole,
} from "./rbac.js";

export function createWorkflowAccessService(deps: {
  collaborators: WorkflowCollaboratorRepository;
  getWorkflowMeta: (id: string) => Promise<{ createdByUserId: string | null } | null>;
}) {
  return {
    async resolveAccess(
      workflowId: string,
      auth: AuthContext,
    ): Promise<WorkflowRole | "admin" | null> {
      if (auth.role === "admin") {
        return "admin";
      }
      const meta = await deps.getWorkflowMeta(workflowId);
      if (!meta) {
        return null;
      }
      return deps.collaborators.getEffectiveRole(
        workflowId,
        auth.userId,
        meta.createdByUserId,
      );
    },

    async assertCanView(workflowId: string, auth: AuthContext): Promise<void> {
      const access = await this.resolveAccess(workflowId, auth);
      const isAdmin = auth.role === "admin";
      const role = access === "admin" ? null : access;
      if (!canViewWorkflow(role, isAdmin)) {
        throw new AwfError("E4003", "无权访问此工作流");
      }
    },

    async assertCanEdit(workflowId: string, auth: AuthContext): Promise<void> {
      const access = await this.resolveAccess(workflowId, auth);
      const isAdmin = auth.role === "admin";
      const role = access === "admin" ? null : access;
      if (!canEditWorkflow(role, isAdmin)) {
        throw new AwfError("E4003", "无权修改此工作流");
      }
    },

    async assertCanShare(workflowId: string, auth: AuthContext): Promise<void> {
      const access = await this.resolveAccess(workflowId, auth);
      const isAdmin = auth.role === "admin";
      const role = access === "admin" ? null : access;
      if (!canShareWorkflow(role, isAdmin)) {
        throw new AwfError("E4003", "无权分享此工作流");
      }
    },
  };
}

export type WorkflowAccessService = ReturnType<typeof createWorkflowAccessService>;
