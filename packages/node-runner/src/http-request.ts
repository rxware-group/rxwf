import type { NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import { decodeBinaryData } from '@rxwf/shared';
import { Agent } from 'undici';
import {
  buildGraphqlRequestBody,
  normalizeHttpBodyContentType,
  normalizeHttpRawBodyContentType,
  rawBodyMimeType,
  type HttpBodyContentType,
  type HttpRawBodyContentType,
} from './http-body.js';
import { resolveItemTemplateString } from './expression/item-context.js';
import { mergeQueryIntoUrl } from './http-key-value.js';
import {
  headersToRecord,
  normalizeHttpResponseBodyContentType,
  normalizeHttpResponseBinaryMode,
  normalizeHttpBinaryPropertyName,
  parseHttpResponseBody,
  type HttpExecutionResult,
  type HttpResponseBodyContentType,
  type HttpResponseBinaryMode,
} from './http-response.js';

export interface HttpRequestConfig {
  method: string;
  url: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: string;
  bodyContentType?: HttpBodyContentType | 'json';
  rawContentType?: HttpRawBodyContentType;
  bodyParameters?: Record<string, unknown>;
  responseBodyContentType?: HttpResponseBodyContentType;
  responseBinaryMode?: HttpResponseBinaryMode;
  responseBinaryPropertyName?: string;
  binaryBodyPropertyName?: string;
}

const HTTP_AGENT_CONNECTIONS = Number(process.env.RXWF_HTTP_KEEPALIVE_CONNECTIONS ?? 128);
const HTTP_AGENT_KEEPALIVE_TIMEOUT = Number(process.env.RXWF_HTTP_KEEPALIVE_TIMEOUT_MS ?? 10_000);
const HTTP_AGENT_KEEPALIVE_MAX_TIMEOUT = Number(
  process.env.RXWF_HTTP_KEEPALIVE_MAX_TIMEOUT_MS ?? 60_000,
);

const httpDispatcher = new Agent({
  connections: Number.isFinite(HTTP_AGENT_CONNECTIONS) ? HTTP_AGENT_CONNECTIONS : 128,
  keepAliveTimeout: Number.isFinite(HTTP_AGENT_KEEPALIVE_TIMEOUT)
    ? HTTP_AGENT_KEEPALIVE_TIMEOUT
    : 10_000,
  keepAliveMaxTimeout: Number.isFinite(HTTP_AGENT_KEEPALIVE_MAX_TIMEOUT)
    ? HTTP_AGENT_KEEPALIVE_MAX_TIMEOUT
    : 60_000,
  pipelining: 1,
});

export async function executeHttpRequest(
  config: HttpRequestConfig,
  itemJson: Record<string, unknown>,
  inputItems: WorkflowItem[],
  env?: Record<string, string>,
  nodes?: NodeOutputEntry[],
  vars?: Record<string, string>,
  itemIndex = 0,
): Promise<HttpExecutionResult> {
  const method = String(config.method ?? 'GET').toUpperCase();
  const url = await resolveItemTemplateString(
    String(config.url ?? ''),
    itemJson,
    inputItems,
    env,
    nodes,
    vars,
  );
  let requestUrl = url;
  if (config.query && typeof config.query === 'object') {
    const resolvedQuery: Record<string, string> = {};
    for (const [key, raw] of Object.entries(config.query)) {
      resolvedQuery[key] = await resolveItemTemplateString(
        String(raw ?? ''),
        itemJson,
        inputItems,
        env,
        nodes,
        vars,
      );
    }
    requestUrl = mergeQueryIntoUrl(url, resolvedQuery);
  }
  const headers: Record<string, string> = {};
  if (config.headers && typeof config.headers === 'object') {
    for (const [key, raw] of Object.entries(config.headers)) {
      headers[key] = await resolveItemTemplateString(
        String(raw ?? ''),
        itemJson,
        inputItems,
        env,
        nodes,
        vars,
      );
    }
  }
  let body: string | FormData | Buffer | undefined;
  const bodyContentType = normalizeHttpBodyContentType(config.bodyContentType);
  const rawContentType = normalizeHttpRawBodyContentType(
    config.rawContentType,
    config.bodyContentType,
  );
  const resolveTemplate = async (template: string) =>
    resolveItemTemplateString(
      template,
      itemJson,
      inputItems,
      env,
      nodes,
      vars,
      itemIndex,
    );
  let skipAutoContentType = false;

  if (bodyContentType === 'x-www-form-urlencoded' && config.bodyParameters) {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(config.bodyParameters)) {
      params.set(key, await resolveTemplate(String(raw ?? '')));
    }
    body = params.toString();
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  } else if (bodyContentType === 'form-data' && config.bodyParameters) {
    const form = new FormData();
    for (const [key, raw] of Object.entries(config.bodyParameters)) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      form.append(trimmedKey, await resolveTemplate(String(raw ?? '')));
    }
    body = form;
    skipAutoContentType = true;
  } else if (bodyContentType === 'binaryFromItem') {
    const prop = normalizeHttpBinaryPropertyName(config.binaryBodyPropertyName);
    const item = inputItems[itemIndex] ?? inputItems[0];
    const attachment = item?.binary?.[prop];
    if (!attachment) {
      throw new Error(`Binary property "${prop}" not found on item`);
    }
    body = decodeBinaryData(attachment);
    if (!headers['Content-Type'] && !headers['content-type'] && attachment.mimeType) {
      headers['Content-Type'] = attachment.mimeType;
    }
  } else if (bodyContentType !== 'none' && config.body !== undefined && config.body !== '') {
    const resolved = await resolveTemplate(String(config.body));
    if (bodyContentType === 'binary') {
      body = Buffer.from(resolved, 'base64');
    } else if (bodyContentType === 'graphql') {
      body = buildGraphqlRequestBody(resolved);
    } else if (bodyContentType === 'raw') {
      body = resolved;
    }
  }

  const init: RequestInit = { method, headers };
  const initWithDispatcher = init as RequestInit & { dispatcher?: Agent };
  initWithDispatcher.dispatcher = httpDispatcher;
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    initWithDispatcher.body = body as BodyInit;
    if (
      !skipAutoContentType &&
      !headers['Content-Type'] &&
      !headers['content-type']
    ) {
      if (bodyContentType === 'raw') {
        headers['Content-Type'] = rawBodyMimeType(rawContentType);
      } else if (bodyContentType === 'binary' || bodyContentType === 'binaryFromItem') {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/octet-stream';
      } else if (bodyContentType === 'graphql') {
        headers['Content-Type'] = 'application/json';
      }
    }
  }
  const response = await fetch(requestUrl, initWithDispatcher);
  const responseBodyContentType = normalizeHttpResponseBodyContentType(
    config.responseBodyContentType,
  );
  const responseBinaryMode = normalizeHttpResponseBinaryMode(
    config.responseBinaryMode,
  );
  const responseBinaryPropertyName = normalizeHttpBinaryPropertyName(
    config.responseBinaryPropertyName,
  );
  const parsed = await parseHttpResponseBody(response, {
    responseBodyContentType,
    responseBinaryMode,
    binaryPropertyName: responseBinaryPropertyName,
  });
  return {
    ok: response.ok,
    statusCode: response.status,
    statusMessage: response.statusText,
    requestUrl,
    responseUrl: response.url,
    redirected: response.redirected,
    requestMethod: method,
    requestHeaders: { ...headers },
    responseHeaders: headersToRecord(response.headers),
    body: parsed.body ?? null,
    ...(parsed.responseBinary ? { responseBinary: parsed.responseBinary } : {}),
  };
}
