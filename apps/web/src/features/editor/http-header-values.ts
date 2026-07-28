import { CONTENT_TYPE_VALUES, HTTP_HEADER_NAMES } from './http-header-names.js';

const ACCEPT_VALUES = [
  '*/*',
  'application/*',
  'application/json',
  'application/xml',
  'application/pdf',
  'application/octet-stream',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/*',
  'text/html',
  'text/plain',
  'text/xml',
  'image/*',
] as const;

const ACCEPT_CHARSET_VALUES = [
  'utf-8',
  'iso-8859-1',
  'us-ascii',
  'utf-16',
  'gbk',
  'gb2312',
  'big5',
] as const;

const ACCEPT_ENCODING_VALUES = [
  'gzip',
  'deflate',
  'br',
  'compress',
  'identity',
  '*',
] as const;

const ACCEPT_LANGUAGE_VALUES = [
  'en-US',
  'en',
  'zh-CN',
  'zh',
  'zh-TW',
  'ja',
  'ja-JP',
  'ko',
  'fr',
  'de',
  'es',
  'pt-BR',
  'ru',
  '*',
] as const;

const HTTP_METHOD_VALUES = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const;

const CACHE_CONTROL_VALUES = [
  'no-cache',
  'no-store',
  'no-transform',
  'must-revalidate',
  'proxy-revalidate',
  'max-age=0',
  'max-age=3600',
  'max-age=86400',
  'private',
  'public',
  'immutable',
  'only-if-cached',
] as const;

const CONNECTION_VALUES = ['keep-alive', 'close'] as const;

const CONTENT_ENCODING_VALUES = ['gzip', 'deflate', 'br', 'compress', 'identity'] as const;

const CONTENT_LANGUAGE_VALUES = ['en-US', 'en', 'zh-CN', 'zh', 'ja', 'fr', 'de', 'es'] as const;

const CONTENT_TRANSFER_ENCODING_VALUES = [
  '7bit',
  '8bit',
  'binary',
  'quoted-printable',
  'base64',
] as const;

const DNT_VALUES = ['0', '1'] as const;

const EXPECT_VALUES = ['100-continue'] as const;

const PRAGMA_VALUES = ['no-cache'] as const;

const RANGE_VALUES = ['bytes=0-', 'bytes=0-499', 'bytes=500-999'] as const;

const SEC_FETCH_DEST_VALUES = [
  'document',
  'empty',
  'iframe',
  'image',
  'object',
  'report',
  'script',
  'style',
  'worker',
  'sharedworker',
] as const;

const SEC_FETCH_MODE_VALUES = [
  'cors',
  'navigate',
  'no-cors',
  'same-origin',
  'websocket',
] as const;

const SEC_FETCH_SITE_VALUES = ['cross-site', 'same-origin', 'same-site', 'none'] as const;

const SEC_FETCH_USER_VALUES = ['?1'] as const;

const TE_VALUES = ['trailers', 'deflate', 'gzip'] as const;

const TRANSFER_ENCODING_VALUES = ['chunked', 'gzip', 'deflate', 'compress'] as const;

const UPGRADE_VALUES = ['websocket', 'h2', 'h2c', 'HTTP/2.0'] as const;

const UPGRADE_INSECURE_REQUESTS_VALUES = ['1'] as const;

const USER_AGENT_VALUES = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'curl/8.5.0',
  'PostmanRuntime/7.36.0',
  'rx-workflow/1.0',
] as const;

const AUTHORIZATION_SCHEME_VALUES = ['Bearer', 'Basic', 'Digest'] as const;

const X_REQUESTED_WITH_VALUES = ['XMLHttpRequest'] as const;

/** Known enumerable values for standard HTTP request headers (lowercase keys). */
const HTTP_HEADER_VALUE_MAP: Record<string, readonly string[]> = {
  accept: ACCEPT_VALUES,
  'accept-charset': ACCEPT_CHARSET_VALUES,
  'accept-encoding': ACCEPT_ENCODING_VALUES,
  'accept-language': ACCEPT_LANGUAGE_VALUES,
  'access-control-request-method': HTTP_METHOD_VALUES,
  authorization: AUTHORIZATION_SCHEME_VALUES,
  'cache-control': CACHE_CONTROL_VALUES,
  connection: CONNECTION_VALUES,
  'content-encoding': CONTENT_ENCODING_VALUES,
  'content-language': CONTENT_LANGUAGE_VALUES,
  'content-transfer-encoding': CONTENT_TRANSFER_ENCODING_VALUES,
  'content-type': CONTENT_TYPE_VALUES,
  dnt: DNT_VALUES,
  expect: EXPECT_VALUES,
  pragma: PRAGMA_VALUES,
  range: RANGE_VALUES,
  'sec-fetch-dest': SEC_FETCH_DEST_VALUES,
  'sec-fetch-mode': SEC_FETCH_MODE_VALUES,
  'sec-fetch-site': SEC_FETCH_SITE_VALUES,
  'sec-fetch-user': SEC_FETCH_USER_VALUES,
  te: TE_VALUES,
  'transfer-encoding': TRANSFER_ENCODING_VALUES,
  upgrade: UPGRADE_VALUES,
  'upgrade-insecure-requests': UPGRADE_INSECURE_REQUESTS_VALUES,
  'user-agent': USER_AGENT_VALUES,
  'x-http-method-override': HTTP_METHOD_VALUES,
  'x-requested-with': X_REQUESTED_WITH_VALUES,
};

const KNOWN_HEADER_KEYS = new Set(HTTP_HEADER_NAMES.map((name) => name.toLowerCase()));

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

export function getHttpHeaderValueSuggestions(headerKey: string): readonly string[] | null {
  const normalized = normalizeHeaderKey(headerKey);
  if (!normalized || !KNOWN_HEADER_KEYS.has(normalized)) {
    return null;
  }
  return HTTP_HEADER_VALUE_MAP[normalized] ?? null;
}

export function headerKeyHasValueSuggestions(headerKey: string): boolean {
  return getHttpHeaderValueSuggestions(headerKey) !== null;
}

export function filterHttpHeaderValues(headerKey: string, query: string): string[] {
  const suggestions = getHttpHeaderValueSuggestions(headerKey);
  if (!suggestions) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [...suggestions];
  return suggestions.filter((value) => value.toLowerCase().includes(q));
}
