import {
  isExpressionTemplate,
  normalizeExpressionTemplate,
} from '@rxwf/expression';
import { parseSwitchBranches } from './switch-branches.js';
import type { ValidationError, WorkflowDefinition } from './validate.js';

function branchOutputIsValid(
  handle: string,
  branches: ReturnType<typeof parseSwitchBranches>,
): boolean {
  if (branches.some((b) => b.id === handle)) return true;
  const index = Number(handle);
  return !Number.isNaN(index) && index >= 0 && index < branches.length;
}

export function validateSwitchNodes(
  definition: WorkflowDefinition,
  errors: ValidationError[],
): void {
  for (const node of definition.nodes) {
    if (node.type !== 'switch') continue;

    const branches = parseSwitchBranches(node.parameters);
    if (branches.length === 0) {
      errors.push({
        code: 'E2003',
        message: `Node ${node.name}: switch requires at least one branch`,
        nodeId: node.id,
      });
      continue;
    }

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]!;
      const condition = branch.condition.trim();
      if (!condition) {
        errors.push({
          code: 'E2003',
          message: `Node ${node.name}: branch ${i + 1} requires a condition expression`,
          nodeId: node.id,
        });
        continue;
      }
      const template = normalizeExpressionTemplate(condition);
      if (!isExpressionTemplate(template)) {
        errors.push({
          code: 'E2003',
          message: `Node ${node.name}: branch ${i + 1} condition must be a {{ }} expression`,
          nodeId: node.id,
        });
      }
    }
  }

  for (const conn of definition.connections) {
    const fromNode = definition.nodes.find((n) => n.id === conn.from);
    if (!fromNode || fromNode.type !== 'switch') continue;

    const branches = parseSwitchBranches(fromNode.parameters);
    if (branches.length === 0) continue;

    const fromOutput = conn.fromOutput ?? 'main';
    if (fromOutput === 'main') continue;

    if (!branchOutputIsValid(fromOutput, branches)) {
      errors.push({
        code: 'E2003',
        message: `Node ${fromNode.name}: output port "${fromOutput}" does not match any switch branch`,
        nodeId: fromNode.id,
      });
    }

    if (
      typeof conn.outputIndex === 'number' &&
      (conn.outputIndex < 0 || conn.outputIndex >= branches.length)
    ) {
      errors.push({
        code: 'E2003',
        message: `Node ${fromNode.name}: outputIndex ${conn.outputIndex} does not match branch count ${branches.length}`,
        nodeId: fromNode.id,
      });
    }
  }
}
