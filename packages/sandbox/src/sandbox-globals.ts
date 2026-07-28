import { buildBootstrapData } from '@rxwf/expression/bootstrap';
import { createExpressionGlobals } from '@rxwf/expression/globals';
import type { ExpressionContext, NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';

export interface CodeSandboxBootstrapInput {
  inputItems: WorkflowItem[];
  env: Record<string, string>;
  vars: Record<string, string>;
  nodes: NodeOutputEntry[];
  itemIndex?: number;
  execution?: ExpressionContext['execution'];
  workflow?: ExpressionContext['workflow'];
}

export function buildCodeSandboxGlobals(input: CodeSandboxBootstrapInput) {
  const itemIndex = input.itemIndex ?? 0;
  const current = input.inputItems[itemIndex] ?? input.inputItems[0];
  const bootstrap = buildBootstrapData({
    json: current?.json ?? {},
    binary: current?.binary,
    input: input.inputItems,
    itemIndex,
    env: input.env,
    vars: input.vars,
    nodes: input.nodes,
    execution: input.execution,
    workflow: input.workflow,
  });
  return createExpressionGlobals(bootstrap);
}
