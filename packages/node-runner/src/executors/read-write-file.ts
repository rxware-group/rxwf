import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import {
  decodeBinaryData,
  encodeBinaryBuffer,
  withJsonPreservingBinary,
  type BinaryAttachment,
  type WorkflowItem,
} from '@rxwf/shared';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { NodeExecutor } from '../types/node-executor.js';
import {
  expressionMetaFromNodeContext,
} from '../expression/item-context.js';
import { resolveItemConfigStringField } from '../expression/resolve-config-string-field.js';

async function resolvePathForItem(
  ctx: NodeExecutionContext,
  itemJson: Record<string, unknown>,
  itemIndex: number,
): Promise<string> {
  return resolveItemConfigStringField(
    ctx.config,
    'path',
    String(ctx.config.path ?? ''),
    itemJson,
    ctx.inputItems,
    ctx.env,
    ctx.nodes,
    ctx.vars,
    itemIndex,
    expressionMetaFromNodeContext(ctx),
  ).then((p) => p.trim());
}

async function resolveWriteContent(
  config: Record<string, unknown>,
  itemJson: Record<string, unknown>,
  ctx: NodeExecutionContext,
  itemIndex: number,
): Promise<string> {
  if (config.content != null && String(config.content).length > 0) {
    return resolveItemConfigStringField(
      config,
      'content',
      String(config.content),
      itemJson,
      ctx.inputItems,
      ctx.env,
      ctx.nodes,
      ctx.vars,
      itemIndex,
      expressionMetaFromNodeContext(ctx),
    );
  }
  if (typeof itemJson.content === 'string') return itemJson.content;
  if (typeof itemJson.data === 'string') return itemJson.data;
  if (itemJson.data != null) return JSON.stringify(itemJson.data);
  return JSON.stringify(itemJson);
}

/** True when user supplied text content (not implicit JSON.stringify fallback). */
function hasExplicitTextContent(
  config: Record<string, unknown>,
  itemJson: Record<string, unknown>,
): boolean {
  if (config.content != null && String(config.content).length > 0) return true;
  if (typeof itemJson.content === 'string' && itemJson.content.length > 0) return true;
  if (typeof itemJson.data === 'string' && itemJson.data.length > 0) return true;
  if (itemJson.data != null && typeof itemJson.data !== 'string') return true;
  return false;
}

function guessMimeTypeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.pdf':
      return 'application/pdf';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.html':
      return 'text/html';
    case '.xml':
      return 'application/xml';
    default:
      return 'application/octet-stream';
  }
}

async function resolveBinaryPropertyName(
  config: Record<string, unknown>,
  ctx: NodeExecutionContext,
  itemJson: Record<string, unknown>,
  itemIndex: number,
): Promise<string> {
  const resolved = await resolveItemConfigStringField(
    config,
    'binaryPropertyName',
    String(config.binaryPropertyName ?? 'data'),
    itemJson,
    ctx.inputItems,
    ctx.env,
    ctx.nodes,
    ctx.vars,
    itemIndex,
    expressionMetaFromNodeContext(ctx),
  );
  const value = resolved.trim();
  return value || 'data';
}

function resolveBinaryAttachment(
  item: { binary?: Record<string, BinaryAttachment> },
  propertyName: string,
): BinaryAttachment {
  const attachment = item.binary?.[propertyName];
  if (!attachment) {
    throw new Error(`输入 item 缺少 binary.${propertyName}`);
  }
  if (!attachment.data && attachment.ref?.blobId) {
    throw new Error(
      `binary.${propertyName} 尚未 hydrate（仅有 ref），无法写入文件`,
    );
  }
  if (!attachment.data) {
    throw new Error(`binary.${propertyName} 无可用数据`);
  }
  return attachment;
}

async function writeItemBinaryToPath(
  item: WorkflowItem,
  path: string,
  propertyName: string,
  operation: 'writeBinary' | 'write',
): Promise<WorkflowItem> {
  const attachment = resolveBinaryAttachment(item, propertyName);
  const buffer = decodeBinaryData(attachment);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return withJsonPreservingBinary(item, {
    operation,
    path,
    bytesWritten: buffer.length,
    mimeType: attachment.mimeType,
    binaryPropertyName: propertyName,
  });
}

export const readWriteFileExecutor: NodeExecutor = {
  type: 'readWriteFile',
  async execute(ctx) {
    const op = String(ctx.config.operation ?? 'read').toLowerCase();
    const items = ctx.inputItems.length > 0 ? ctx.inputItems : [{ json: {} }];

    if (op === 'read') {
      const path = await resolvePathForItem(ctx, items[0]!.json, 0);
      if (!path) {
        return {
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: '路径不能为空',
          outputItems: [[]],
        };
      }
      try {
        const content = await readFile(path, 'utf8');
        return {
          status: 'success',
          outputItems: [[{ json: { operation: 'read', path, content } }]],
        };
      } catch (e) {
        return {
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: e instanceof Error ? e.message : String(e),
          outputItems: [[]],
        };
      }
    }

    if (op === 'readbinary') {
      const path = await resolvePathForItem(ctx, items[0]!.json, 0);
      if (!path) {
        return {
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: '路径不能为空',
          outputItems: [[]],
        };
      }
      try {
        const buffer = await readFile(path);
        const propertyName = await resolveBinaryPropertyName(
          ctx.config,
          ctx,
          items[0]!.json,
          0,
        );
        const fileName = basename(path);
        const mimeType = guessMimeTypeFromPath(path);
        return {
          status: 'success',
          outputItems: [
            [
              {
                json: {
                  operation: 'readBinary',
                  path,
                  fileSize: buffer.length,
                  mimeType,
                },
                binary: {
                  [propertyName]: encodeBinaryBuffer(buffer, mimeType, { fileName }),
                },
              },
            ],
          ],
        };
      } catch (e) {
        return {
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: e instanceof Error ? e.message : String(e),
          outputItems: [[]],
        };
      }
    }

    if (op === 'writebinary') {
      const outputItems: WorkflowItem[] = [];

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const item = items[itemIndex]!;
        try {
          const path = await resolvePathForItem(ctx, item.json, itemIndex);
          if (!path) {
            return {
              status: 'failed',
              errorCode: 'E2002',
              errorMessage: '路径不能为空',
              outputItems: outputItems.length ? [outputItems] : [[]],
            };
          }
          const propertyName = await resolveBinaryPropertyName(
            ctx.config,
            ctx,
            item.json,
            itemIndex,
          );
          outputItems.push(
            await writeItemBinaryToPath(item, path, propertyName, 'writeBinary'),
          );
        } catch (e) {
          return {
            status: 'failed',
            errorCode: 'E2002',
            errorMessage: e instanceof Error ? e.message : String(e),
            outputItems: outputItems.length ? [outputItems] : [[]],
          };
        }
      }

      return {
        status: 'success',
        outputItems: [outputItems],
      };
    }

    if (op === 'write' || op === 'append') {
      const outputItems: WorkflowItem[] = [];

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const item = items[itemIndex]!;
        try {
          const path = await resolvePathForItem(ctx, item.json, itemIndex);
          if (!path) {
            return {
              status: 'failed',
              errorCode: 'E2002',
              errorMessage: '路径不能为空',
              outputItems: outputItems.length ? [outputItems] : [[]],
            };
          }
          const propertyName = await resolveBinaryPropertyName(
            ctx.config,
            ctx,
            item.json,
            itemIndex,
          );
          if (
            op === 'write' &&
            !hasExplicitTextContent(ctx.config, item.json) &&
            item.binary?.[propertyName]
          ) {
            outputItems.push(await writeItemBinaryToPath(item, path, propertyName, 'write'));
            continue;
          }

          const content = await resolveWriteContent(
            ctx.config,
            item.json,
            ctx,
            itemIndex,
          );
          await mkdir(dirname(path), { recursive: true });
          if (op === 'append') {
            await appendFile(path, content, 'utf8');
          } else {
            await writeFile(path, content, 'utf8');
          }
          outputItems.push({
            json: {
              operation: op,
              path,
              bytesWritten: Buffer.byteLength(content, 'utf8'),
            },
          });
        } catch (e) {
          return {
            status: 'failed',
            errorCode: 'E2002',
            errorMessage: e instanceof Error ? e.message : String(e),
            outputItems: outputItems.length ? [outputItems] : [[]],
          };
        }
      }

      return {
        status: 'success',
        outputItems: [outputItems],
      };
    }

    return {
      status: 'failed',
      errorCode: 'E2002',
      errorMessage: `不支持的操作: ${op}`,
      outputItems: [[]],
    };
  },
};
