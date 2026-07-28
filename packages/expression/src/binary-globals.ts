import type { BinaryAttachment, BinaryMap } from '@rxwf/shared';
import { isBinaryAttachment, isBinaryMap } from '@rxwf/shared';
import type { ExpressionContext } from './types.js';

/** Resolve `$binary` global from expression context (current item). */
export function resolveBinaryGlobal(
  context: ExpressionContext,
): BinaryMap | undefined {
  if (context.binary) return context.binary;
  const items = context.input ?? [];
  const idx = context.itemIndex ?? 0;
  return items[idx]?.binary ?? items[0]?.binary;
}

/** Read a named attachment from `$binary`; defaults to `data`. */
export function readBinaryAttachment(
  binary: BinaryMap | undefined,
  propertyName = 'data',
): BinaryAttachment | undefined {
  if (!binary) return undefined;
  return binary[propertyName];
}

/** True when expression result is usable as `item.binary` merge payload (§5.5). */
export function isExpressionBinaryResult(value: unknown): value is BinaryMap {
  return isBinaryMap(value);
}

/**
 * Coerce expression evaluation result to `BinaryMap` for node write path.
 * Accepts a full map or a single attachment (wrapped under `data`).
 */
export function coerceExpressionBinaryResult(value: unknown): BinaryMap | undefined {
  if (value === null || value === undefined) return undefined;
  if (isBinaryMap(value)) return value;
  if (isBinaryAttachment(value)) return { data: value };
  return undefined;
}
