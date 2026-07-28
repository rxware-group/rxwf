import type { BinaryMap, WorkflowItem } from '../item.js';
import {
  DEFAULT_BINARY_INLINE_MAX_BYTES,
  decodeBinaryData,
  encodeBinaryBuffer,
} from './binary-utils.js';

export interface BinaryBlobStore {
  store(params: {
    executionId: string;
    nodeRunId?: string;
    kind: 'input' | 'output';
    buffer: Buffer;
  }): Promise<{ blobId: string }>;
  load(blobId: string): Promise<Buffer>;
}

export async function externalizeItemBinaryAttachments(
  item: WorkflowItem,
  ctx: {
    executionId: string;
    nodeRunId: string;
    store: BinaryBlobStore;
  },
  options?: { inlineMaxBytes?: number },
): Promise<WorkflowItem> {
  if (!item.binary) return item;
  const inlineMax = options?.inlineMaxBytes ?? DEFAULT_BINARY_INLINE_MAX_BYTES;
  const binary: BinaryMap = {};

  for (const [key, attachment] of Object.entries(item.binary)) {
    if (attachment.ref?.blobId) {
      binary[key] = { ...attachment, data: '' };
      continue;
    }
    const buffer = decodeBinaryData(attachment);
    if (buffer.length <= inlineMax) {
      binary[key] = {
        ...attachment,
        fileSize: attachment.fileSize ?? buffer.length,
      };
      continue;
    }
    const { blobId } = await ctx.store.store({
      executionId: ctx.executionId,
      nodeRunId: ctx.nodeRunId,
      kind: 'output',
      buffer,
    });
    binary[key] = {
      data: '',
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize ?? buffer.length,
      ref: { blobId },
    };
  }

  return { ...item, binary };
}

export async function externalizeOutputItems(
  outputItems: WorkflowItem[][],
  ctx: {
    executionId: string;
    nodeRunId: string;
    store: BinaryBlobStore;
  },
  options?: { inlineMaxBytes?: number },
): Promise<WorkflowItem[][]> {
  return Promise.all(
    outputItems.map((branch) =>
      Promise.all(
        branch.map((item) =>
          externalizeItemBinaryAttachments(item, ctx, options),
        ),
      ),
    ),
  );
}

export async function hydrateWorkflowItem(
  item: WorkflowItem,
  load: (blobId: string) => Promise<Buffer>,
): Promise<WorkflowItem> {
  if (!item.binary) return item;
  const binary: BinaryMap = {};

  for (const [key, attachment] of Object.entries(item.binary)) {
    if (attachment.ref?.blobId && !attachment.data) {
      const buffer = await load(attachment.ref.blobId);
      binary[key] = encodeBinaryBuffer(buffer, attachment.mimeType, {
        fileName: attachment.fileName,
      });
    } else {
      binary[key] = attachment;
    }
  }

  return { ...item, binary };
}

export async function hydrateWorkflowItems(
  items: WorkflowItem[],
  load: (blobId: string) => Promise<Buffer>,
): Promise<WorkflowItem[]> {
  return Promise.all(items.map((item) => hydrateWorkflowItem(item, load)));
}
