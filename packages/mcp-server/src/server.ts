import type { WorkflowDefinition } from '@rxwf/workflow';
import type { McpDeps, McpToolCall, McpToolResult } from './types.js';

export const MCP_TOOL_NAMES = [
  'workflow_list',
  'workflow_get',
  'workflow_create',
  'workflow_update',
  'workflow_execute',
  'execution_get',
  'execution_list',
  'workflow_validate',
  'runner_list',
  'runner_create_registration_token',
] as const;

export function createMcpToolHandler(deps: McpDeps) {
  return {
    async listTools() {
      const base = MCP_TOOL_NAMES.map((name) => ({
        name,
        description: `rx-workflow ${name}`,
      }));
      const extra = deps.listExtraTools ? await deps.listExtraTools() : [];
      return [...base, ...extra];
    },

    async callTool(call: McpToolCall): Promise<McpToolResult> {
      try {
        const text = await dispatch(deps, call);
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  };
}

async function dispatch(deps: McpDeps, call: McpToolCall): Promise<string> {
  switch (call.name) {
    case 'workflow_list': {
      const list = await deps.listWorkflows();
      return JSON.stringify(list);
    }
    case 'workflow_get': {
      const id = String(call.arguments.workflowId ?? '');
      const wf = await deps.getWorkflow(id);
      if (!wf) throw new Error('Workflow not found');
      return JSON.stringify(wf);
    }
    case 'workflow_create': {
      const name = String(call.arguments.name ?? 'MCP Flow');
      const definition = call.arguments.definition as WorkflowDefinition;
      const created = await deps.createWorkflow(name, definition);
      return JSON.stringify(created);
    }
    case 'workflow_update': {
      const id = String(call.arguments.workflowId ?? '');
      const definition = call.arguments.definition as WorkflowDefinition;
      await deps.updateWorkflow(id, definition);
      return JSON.stringify({ ok: true });
    }
    case 'workflow_validate': {
      const definition = call.arguments.definition as WorkflowDefinition;
      const result = await deps.validate(definition);
      return JSON.stringify(result);
    }
    case 'workflow_execute': {
      const id = String(call.arguments.workflowId ?? '');
      const result = await deps.executeWorkflow(id);
      return JSON.stringify(result);
    }
    case 'execution_get': {
      const id = String(call.arguments.executionId ?? '');
      const ex = await deps.getExecution(id);
      if (!ex) throw new Error('Execution not found');
      return JSON.stringify(ex);
    }
    case 'execution_list': {
      const workflowId = String(call.arguments.workflowId ?? '');
      const list = await deps.listExecutions(workflowId);
      return JSON.stringify(list);
    }
    case 'runner_list': {
      const list = await deps.listRunners();
      return JSON.stringify(list);
    }
    case 'runner_create_registration_token': {
      const expiresInHours =
        typeof call.arguments.expiresInHours === 'number'
          ? call.arguments.expiresInHours
          : undefined;
      const labels = Array.isArray(call.arguments.labels)
        ? call.arguments.labels.filter((l): l is string => typeof l === 'string')
        : undefined;
      const result = await deps.createRunnerRegistrationToken({
        expiresInHours,
        labels,
      });
      return JSON.stringify(result);
    }
    default: {
      if (deps.callExtraTool) {
        return deps.callExtraTool(call.name, call.arguments);
      }
      throw new Error(`Unknown tool: ${call.name}`);
    }
  }
}
