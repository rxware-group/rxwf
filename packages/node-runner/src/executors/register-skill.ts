import type { ExecutorRegistry } from '../registry/executor-registry.js';
import { createSkillRunExecutor } from './skill-run.js';
import { createWorkflowRunExecutor } from './workflow-run.js';
import type { PlusExecutorDeps } from './register-plus.js';

export function registerSkillExecutors(
  registry: ExecutorRegistry,
  deps: PlusExecutorDeps,
): void {
  registry.register(createSkillRunExecutor(deps));
  registry.register(createWorkflowRunExecutor(deps));
}
