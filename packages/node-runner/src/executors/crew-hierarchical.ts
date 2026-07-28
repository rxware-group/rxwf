import type { NodeExecutor } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { executeCrewNode } from './crew-backend-router.js';

export type { CrewStepRecord } from './crew-helpers.js';

export function createCrewHierarchicalExecutor(deps: PlusExecutorDeps): NodeExecutor {
  return {
    type: 'crewHierarchical',
    async execute(ctx) {
      return executeCrewNode(ctx, deps, 'crewHierarchical');
    },
  };
}
