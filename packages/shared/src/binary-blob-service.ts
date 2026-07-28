import type { WorkflowItem } from './item.js';
import type { BinaryBlobStore } from './binary/binary-persistence.js';
import {
  externalizeItemBinaryAttachments,
  externalizeOutputItems as externalizeOutputItemsCore,
  hydrateWorkflowItem,
  hydrateWorkflowItems,
} from './binary/binary-persistence.js';
import {
  DEFAULT_BINARY_INLINE_MAX_BYTES,
  DEFAULT_BINARY_ITEM_MAX_BYTES,
  totalBinaryBytes,
} from './binary/binary-utils.js';
import { AwfError } from './errors.js';

export interface BinaryBlobServiceOptions {
  inlineMaxBytes?: number;
  itemMaxBytes?: number;
}

/** Profile-level blob facade: store/load + hydrate/externalize with OPT-01 thresholds. */
export interface BinaryBlobService extends BinaryBlobStore {
  hydrateItem(item: WorkflowItem): Promise<WorkflowItem>;
  hydrateItems(items: WorkflowItem[]): Promise<WorkflowItem[]>;
  externalizeItem(
    item: WorkflowItem,
    ctx: { executionId: string; nodeRunId: string },
  ): Promise<WorkflowItem>;
  externalizeOutputItems(
    outputItems: WorkflowItem[][],
    ctx: { executionId: string; nodeRunId: string },
  ): Promise<WorkflowItem[][]>;
}

/** GAP-02: Standard profile blob backend planned for post-M-5 (OPT-01 Lite-only). */
export const STANDARD_BINARY_BLOB_PLAN = {
  profile: 'standard' as const,
  status: 'planned' as const,
  table: 'execution_blobs',
  storage: 'postgres_row + object_store_key',
  note:
    'M-5 delivers Lite SQLite + local files; Standard uses same execution_blobs schema on Postgres with pluggable object storage.',
};

export function resolveBinaryInlineMaxBytesFromEnv(
  fallback = DEFAULT_BINARY_INLINE_MAX_BYTES,
): number {
  const raw = process.env.RXWF_BINARY_INLINE_MAX_BYTES;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function resolveBinaryItemMaxBytesFromEnv(
  fallback = DEFAULT_BINARY_ITEM_MAX_BYTES,
): number {
  const raw = process.env.RXWF_BINARY_ITEM_MAX_BYTES;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function createBinaryBlobService(
  store: BinaryBlobStore,
  options?: BinaryBlobServiceOptions,
): BinaryBlobService {
  const inlineMax =
    options?.inlineMaxBytes ?? DEFAULT_BINARY_INLINE_MAX_BYTES;
  const itemMax = options?.itemMaxBytes ?? DEFAULT_BINARY_ITEM_MAX_BYTES;

  const assertItemBinaryLimit = (item: WorkflowItem) => {
    const total = totalBinaryBytes(item.binary);
    if (total > itemMax) {
      throw new AwfError(
        'E2002',
        `Binary item exceeds ${itemMax} bytes limit (${total})`,
      );
    }
  };

  const persistenceCtx = (
    executionId: string,
    nodeRunId: string,
  ): {
    executionId: string;
    nodeRunId: string;
    store: BinaryBlobStore;
  } => ({
    executionId,
    nodeRunId,
    store,
  });

  return {
    store: store.store,
    load: store.load,
    hydrateItem: (item) => hydrateWorkflowItem(item, store.load),
    hydrateItems: (items) => hydrateWorkflowItems(items, store.load),
    externalizeItem: async (item, ctx) => {
      assertItemBinaryLimit(item);
      return externalizeItemBinaryAttachments(
        item,
        persistenceCtx(ctx.executionId, ctx.nodeRunId),
        { inlineMaxBytes: inlineMax },
      );
    },
    externalizeOutputItems: async (outputItems, ctx) => {
      for (const branch of outputItems) {
        for (const item of branch) {
          assertItemBinaryLimit(item);
        }
      }
      return externalizeOutputItemsCore(
        outputItems,
        persistenceCtx(ctx.executionId, ctx.nodeRunId),
        { inlineMaxBytes: inlineMax },
      );
    },
  };
}

export function createBinaryBlobServiceFromEnv(
  store: BinaryBlobStore,
): BinaryBlobService {
  return createBinaryBlobService(store, {
    inlineMaxBytes: resolveBinaryInlineMaxBytesFromEnv(),
    itemMaxBytes: resolveBinaryItemMaxBytesFromEnv(),
  });
}

export type { BinaryBlobStore };
