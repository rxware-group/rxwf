import { AwfError } from '@rxwf/shared';
import type { NodeExecutor } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { runAiAgentNode } from './run-ai-agent-node.js';

export function createAiAgentExecutor(deps: PlusExecutorDeps): NodeExecutor {
  return {
    type: 'aiAgent',
    async execute(ctx) {
      if (!deps.ai) {
        throw new AwfError('E3001', 'AI runtime not configured');
      }
      const agentNodeId = ctx.nodeId;
      if (!ctx.workflowDefinition || !agentNodeId) {
        throw new AwfError('E2003', 'AI Agent requires workflow definition context');
      }
      return runAiAgentNode(ctx, deps, {
        agentNodeId,
        agentParams: ctx.config,
      });
    },
  };
}
