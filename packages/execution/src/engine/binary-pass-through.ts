import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import { mergeBinaryMaps, withJsonPreservingBinary } from '@rxwf/shared';

function itemHasBinary(item: WorkflowItem): boolean {
  return item.binary !== undefined && Object.keys(item.binary).length > 0;
}

/**
 * Design spec §4.2 preserveBinary — update json/binary while retaining input.binary
 * unless explicitly patched. RISK-01: shared already has withJsonPreservingBinary;
 * this generalizes with optional binary merge.
 */
export function preserveBinary(
  input: WorkflowItem,
  patch: Partial<Pick<WorkflowItem, 'json' | 'binary'>>,
): WorkflowItem {
  if (patch.binary !== undefined) {
    const json = patch.json ?? input.json;
    const binary = mergeBinaryMaps(input.binary, patch.binary);
    const out: WorkflowItem = { json };
    if (binary && Object.keys(binary).length > 0) {
      out.binary = binary;
    }
    return out;
  }
  if (patch.json !== undefined) {
    return withJsonPreservingBinary(input, patch.json);
  }
  return input;
}

/** Copy missing binary from input onto output (output keys win on conflict). */
export function passThroughBinaryItem(
  input: WorkflowItem,
  output: WorkflowItem,
): WorkflowItem {
  if (!itemHasBinary(input)) return output;
  if (!itemHasBinary(output)) {
    return { ...output, binary: { ...input.binary! } };
  }
  const merged = mergeBinaryMaps(input.binary, output.binary);
  if (!merged) return output;
  return { ...output, binary: merged };
}

/** Pair output items with input items by index; restore dropped binary. */
export function passThroughBinaryByIndex(
  inputItems: WorkflowItem[],
  outputItems: WorkflowItem[],
): WorkflowItem[] {
  return outputItems.map((out, index) => {
    const inp = inputItems[index];
    if (!inp) return out;
    return passThroughBinaryItem(inp, out);
  });
}

/** Apply binary pass-through to all branches of a node output (engine handoff). */
export function passThroughBinaryOnOutput(
  inputItems: WorkflowItem[],
  outputBranches: WorkflowItem[][],
): WorkflowItem[][] {
  return outputBranches.map((branch) =>
    passThroughBinaryByIndex(inputItems, branch),
  );
}

export type { BinaryMap, WorkflowItem };
