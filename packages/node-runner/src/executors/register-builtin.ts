import { runInSandbox } from '@rxwf/sandbox';
import type { NodeExecutor } from '../types/node-executor.js';
import { createHttpRequestExecutor } from './http.js';
import { ifExecutor } from './control-flow/if.js';
import { switchExecutor } from './control-flow/switch.js';
import { mergeExecutor } from './control-flow/merge.js';
import { loopExecutor } from './control-flow/loop.js';
import { waitExecutor } from './control-flow/wait.js';
import { humanApprovalExecutor } from './control-flow/human-approval.js';
import { setExecutor } from './transform/set.js';
import { jsonExecutor } from './transform/json.js';
import { createCodeExecutor } from './code.js';
import { executeCommandExecutor } from './execute-command.js';
import { errorTriggerExecutor } from './triggers/error.js';
import { manualTriggerExecutor } from './triggers/manual.js';
import { webhookTriggerExecutor } from './triggers/webhook.js';
import { scheduleTriggerExecutor } from './triggers/schedule.js';
import { subworkflowTriggerExecutor } from './triggers/subworkflow.js';
import {
  createSubworkflowExecutor,
  type SubworkflowExecutorDeps,
} from './subworkflow.js';
import type { ExecutorRegistry } from '../registry/executor-registry.js';

export interface BuiltinExecutorDeps {
  subworkflow?: SubworkflowExecutorDeps;
  resolveCredentialForAuth?: import('./http.js').HttpRequestExecutorDeps['resolveCredentialForAuth'];
}

export function registerBuiltinExecutors(
  registry: ExecutorRegistry,
  deps: BuiltinExecutorDeps = {},
): void {
  const executors: NodeExecutor[] = [
    createHttpRequestExecutor({
      resolveCredentialForAuth: deps.resolveCredentialForAuth,
    }),
    ifExecutor,
    switchExecutor,
    mergeExecutor,
    loopExecutor,
    waitExecutor,
    humanApprovalExecutor,
    setExecutor,
    jsonExecutor,
    createCodeExecutor({ runInSandbox }),
    executeCommandExecutor,
    errorTriggerExecutor,
    manualTriggerExecutor,
    webhookTriggerExecutor,
    scheduleTriggerExecutor,
    subworkflowTriggerExecutor,
  ];
  if (deps.subworkflow) {
    executors.push(createSubworkflowExecutor(deps.subworkflow));
  }
  for (const ex of executors) {
    registry.register(ex);
  }
}
