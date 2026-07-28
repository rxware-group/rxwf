import { applyAuth } from '@rxwf/credential';
import { mergeBinaryMaps, type WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../types/node-executor.js';
import {
  normalizeHttpBodyContentType,
  normalizeHttpRawBodyContentType,
} from '../http-body.js';
import {
  httpKeyValueRowsToRecord,
  normalizeHttpKeyValueRows,
} from '../http-key-value.js';
import { executeHttpRequest } from '../http-request.js';
import {
  buildHttpNodeOutputJson,
  normalizeHttpBinaryPropertyName,
  normalizeHttpResponseBinaryMode,
  normalizeHttpResponseBodyContentType,
} from '../http-response.js';
export interface HttpRequestExecutorDeps {
  resolveCredentialForAuth?: (
    credentialId: string,
  ) => Promise<{ type: string; data: Record<string, unknown> }>;
}

function readHttpNodeConcurrency(): number {
  const raw = Number(process.env.RXWF_HTTP_NODE_CONCURRENCY ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.max(1, Math.floor(raw));
}

type HttpBodyContentType =
  | 'none'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'raw'
  | 'binary'
  | 'binaryFromItem'
  | 'graphql';

function readHttpBodyContentType(raw: unknown): HttpBodyContentType {
  return normalizeHttpBodyContentType(raw);
}

function usesHttpBodyParameters(bodyContentType: HttpBodyContentType): boolean {
  return bodyContentType === 'x-www-form-urlencoded' || bodyContentType === 'form-data';
}

function usesHttpBodyString(bodyContentType: HttpBodyContentType): boolean {
  return bodyContentType === 'raw' || bodyContentType === 'binary' || bodyContentType === 'graphql';
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (tasks.length > 0) {
      const task = tasks.shift();
      if (!task) return;
      await task();
    }
  });
  await Promise.all(workers);
}

export function createHttpRequestExecutor(
  deps: HttpRequestExecutorDeps = {},
): NodeExecutor {
  return {
    type: 'httpRequest',
    async execute(ctx) {
      const output: WorkflowItem[] = Array.from(
        { length: ctx.inputItems.length },
        () => ({ json: {} }),
      );
      const manualHeaders =
        ctx.config.headers && typeof ctx.config.headers === 'object'
          ? (ctx.config.headers as Record<string, unknown>)
          : undefined;
      const sendHeaders = ctx.config.sendHeaders === true;
      const sendQuery = ctx.config.sendQuery === true;
      const sendBody = ctx.config.sendBody === true;
      const responseBodyContentType = normalizeHttpResponseBodyContentType(
        ctx.config.responseBodyContentType,
      );
      const responseBinaryMode = normalizeHttpResponseBinaryMode(
        ctx.config.responseBinaryMode,
      );
      const responseBinaryPropertyName = normalizeHttpBinaryPropertyName(
        ctx.config.responseBinaryPropertyName,
      );
      const binaryBodyPropertyName = normalizeHttpBinaryPropertyName(
        ctx.config.binaryBodyPropertyName ?? ctx.config.binaryProperty,
      );
      let headers: Record<string, unknown> | undefined = manualHeaders;
      const credentialId = ctx.config.credentialId
        ? String(ctx.config.credentialId).trim()
        : '';
      if (credentialId && deps.resolveCredentialForAuth) {
        const { type, data } = await deps.resolveCredentialForAuth(credentialId);
        const authHeaders = applyAuth(type, data);
        headers = { ...authHeaders, ...manualHeaders };
      }
      if (sendHeaders) {
        const rowHeaders = httpKeyValueRowsToRecord(
          normalizeHttpKeyValueRows(ctx.config.headerParameters),
        );
        headers = { ...(headers ?? {}), ...rowHeaders };
      }
      const query = sendQuery
        ? httpKeyValueRowsToRecord(normalizeHttpKeyValueRows(ctx.config.queryParameters))
        : undefined;
      const bodyContentType = readHttpBodyContentType(ctx.config.bodyContentType);
      const rawContentType = normalizeHttpRawBodyContentType(
        ctx.config.rawContentType,
        ctx.config.bodyContentType,
      );
      const requestBody =
        sendBody && usesHttpBodyString(bodyContentType)
          ? ctx.config.body !== undefined
            ? String(ctx.config.body)
            : undefined
          : undefined;
      const bodyParameters =
        sendBody && usesHttpBodyParameters(bodyContentType)
          ? httpKeyValueRowsToRecord(normalizeHttpKeyValueRows(ctx.config.bodyParameters))
          : undefined;

      const tasks = ctx.inputItems.map(
        (item, idx) => async () => {
          try {
            const result = await executeHttpRequest(
              {
                method: String(ctx.config.method ?? 'GET'),
                url: String(ctx.config.url ?? ''),
                headers,
                query,
                body: requestBody,
                bodyContentType:
                  sendBody && bodyContentType !== 'none' ? bodyContentType : undefined,
                rawContentType:
                  sendBody && bodyContentType === 'raw' ? rawContentType : undefined,
                bodyParameters,
                responseBodyContentType,
                responseBinaryMode,
                responseBinaryPropertyName,
                binaryBodyPropertyName,
              },
              item.json,
              ctx.inputItems,
              ctx.env,
              ctx.nodes,
              ctx.vars,
              idx,
            );
            const httpError =
              result.statusCode >= 200 && result.statusCode < 300
                ? undefined
                : `HTTP ${result.statusCode} for ${result.requestUrl}`;
            const outputItem: WorkflowItem = {
              json: buildHttpNodeOutputJson(result, httpError),
            };
            if (result.responseBinary) {
              outputItem.binary = mergeBinaryMaps(item.binary, {
                [result.responseBinary.propertyName]: result.responseBinary.attachment,
              });
            } else if (item.binary && Object.keys(item.binary).length > 0) {
              outputItem.binary = item.binary;
            }
            output[idx] = outputItem;
          } catch (error) {
            output[idx] = {
              json: buildHttpNodeOutputJson(
                {
                  ok: false,
                  statusCode: 0,
                  statusMessage: '',
                  requestUrl: '',
                  responseUrl: '',
                  redirected: false,
                  requestMethod: String(ctx.config.method ?? 'GET').toUpperCase(),
                  requestHeaders: {},
                  responseHeaders: {},
                  body: null,
                },
                error instanceof Error ? error.message : String(error),
              ),
            };
          }
        },
      );
      await runWithConcurrency(tasks, readHttpNodeConcurrency());

      return {
        status: 'success',
        outputItems: [output],
      };
    },
  };
}

export const httpRequestExecutor = createHttpRequestExecutor();
