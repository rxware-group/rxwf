import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../../types/node-executor.js';
import { AwfError } from '@rxwf/shared';
import {
  buildCombineAllItem,
  mergeJsonItemsWithBinary,
} from './merge-binary.js';

function branchItems(
  ctx: { inputBranches?: WorkflowItem[][]; inputItems: WorkflowItem[] },
): WorkflowItem[][] {
  return ctx.inputBranches ?? [ctx.inputItems];
}

export const mergeExecutor: NodeExecutor = {
  type: 'merge',
  async execute(ctx) {
    const mode = String(ctx.config.mode ?? 'append');
    const branches = branchItems(ctx);

    if (mode === 'append') {
      const merged = branches.flat();
      return { status: 'success', outputItems: [merged] };
    }

    if (mode === 'combineByKey') {
      const matchField = String(ctx.config.matchField ?? '').trim();
      if (!matchField) {
        throw new AwfError('E2002', 'merge combineByKey requires matchField');
      }
      const byKey = new Map<string, WorkflowItem[]>();
      for (const branch of branches) {
        for (const item of branch) {
          const keyValue = item.json?.[matchField];
          const key =
            keyValue === undefined || keyValue === null
              ? ''
              : String(keyValue);
          const bucket = byKey.get(key) ?? [];
          bucket.push(item);
          byKey.set(key, bucket);
        }
      }
      const merged = [...byKey.values()].map((group) => mergeJsonItemsWithBinary(group));
      return { status: 'success', outputItems: [merged] };
    }

    if (mode === 'combineAll') {
      return {
        status: 'success',
        outputItems: [[buildCombineAllItem(branches)]],
      };
    }

    return {
      status: 'failed',
      errorCode: 'E2002',
      errorMessage: `Unsupported merge mode: ${mode}`,
    };
  },
};
