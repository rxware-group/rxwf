import type { BinaryMap, WorkflowItem } from '@rxwf/shared';
import {
  isBinaryAttachment,
  isBinaryMap,
  mergeBinaryMaps,
} from '@rxwf/shared';

export function splitResolvedSetFields(resolved: Record<string, unknown>): {
  json: Record<string, unknown>;
  binary?: BinaryMap;
} {
  if (isBinaryMap(resolved)) {
    return { json: {}, binary: resolved };
  }

  const json: Record<string, unknown> = {};
  let binary: BinaryMap | undefined;

  for (const [key, value] of Object.entries(resolved)) {
    if (isBinaryAttachment(value)) {
      binary = { ...(binary ?? {}), [key]: value };
      continue;
    }
    if (isBinaryMap(value)) {
      binary = mergeBinaryMaps(binary, value);
      continue;
    }
    json[key] = value;
  }

  return { json, binary };
}

/** Apply resolved Set fields: merge json patch and merge binary maps (CONF-04 / design §5.4). */
export function applySetBinaryToItem(
  item: WorkflowItem,
  resolved: Record<string, unknown>,
): WorkflowItem {
  const { json: jsonPatch, binary: binaryPatch } = splitResolvedSetFields(resolved);
  const out: WorkflowItem = {
    json: { ...item.json, ...jsonPatch },
  };
  const mergedBinary = mergeBinaryMaps(item.binary, binaryPatch);
  if (mergedBinary && Object.keys(mergedBinary).length > 0) {
    out.binary = mergedBinary;
  }
  return out;
}
