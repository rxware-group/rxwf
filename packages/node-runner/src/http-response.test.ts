import { describe, expect, it } from 'vitest';
import {
  buildHttpNodeOutputJson,
  formatHttpResponseBodyText,
  headersToRecord,
  parseHttpResponseBody,
} from './http-response.js';

describe('http-response', () => {
  it('parses JSON response bodies regardless of ok flag', async () => {
    const response = new Response(JSON.stringify({ hello: 'world' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
    await expect(parseHttpResponseBody(response)).resolves.toEqual({
      body: { hello: 'world' },
    });
  });

  it('parses response body using explicit JSON type', async () => {
    const response = new Response(JSON.stringify({ hello: 'world' }), {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
    await expect(
      parseHttpResponseBody(response, { responseBodyContentType: 'json' }),
    ).resolves.toEqual({ body: { hello: 'world' } });
  });

  it('keeps HTML as text when response body type is html', async () => {
    const response = new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
    await expect(
      parseHttpResponseBody(response, { responseBodyContentType: 'html' }),
    ).resolves.toEqual({ body: '<html></html>' });
  });

  it('returns plain text for non-JSON content types', async () => {
    const response = new Response('plain text', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
    await expect(parseHttpResponseBody(response)).resolves.toEqual({
      body: 'plain text',
    });
  });

  it('collects response headers into a record', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-test': 'yes',
    });
    expect(headersToRecord(headers)).toEqual({
      'content-type': 'application/json',
      'x-test': 'yes',
    });
  });

  it('formats JSON response text', () => {
    expect(formatHttpResponseBodyText('{"a":1}', 'json')).toEqual({ a: 1 });
    expect(formatHttpResponseBodyText('not-json', 'json')).toBe('not-json');
  });

  it('always includes response headers and body in output', () => {
    const json = buildHttpNodeOutputJson(
      {
        ok: true,
        statusCode: 200,
        statusMessage: 'OK',
        requestUrl: 'https://example.com',
        responseUrl: 'https://example.com',
        redirected: false,
        requestMethod: 'GET',
        requestHeaders: { accept: 'application/json' },
        responseHeaders: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      },
      undefined,
      { outputResponseHeaders: false, outputResponseBody: false },
    );

    expect(json.headers).toEqual({ 'content-type': 'application/json' });
    expect(json.body).toEqual({ hello: 'world' });
    expect(json.statusCode).toBe(200);
  });

  it('omits body from json output when responseBinary is present', () => {
    const json = buildHttpNodeOutputJson({
      ok: true,
      statusCode: 200,
      statusMessage: 'OK',
      requestUrl: 'https://example.com',
      responseUrl: 'https://example.com',
      redirected: false,
      requestMethod: 'GET',
      requestHeaders: {},
      responseHeaders: { 'content-type': 'image/png' },
      body: null,
      responseBinary: {
        propertyName: 'data',
        attachment: {
          data: 'abc',
          mimeType: 'image/png',
          fileSize: 3,
        },
      },
    });

    expect(json.body).toBeUndefined();
    expect(json.statusCode).toBe(200);
  });

  it('parses PNG response as binary when mode is auto', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const response = new Response(pngBytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
    const parsed = await parseHttpResponseBody(response, {
      responseBinaryMode: 'auto',
    });
    expect(parsed.responseBinary?.attachment.mimeType).toBe('image/png');
    expect(parsed.responseBinary?.propertyName).toBe('data');
    expect(parsed.body).toBeUndefined();
  });

  it('ignores legacy output toggle options', () => {
    const json = buildHttpNodeOutputJson(
      {
        ok: true,
        statusCode: 200,
        statusMessage: 'OK',
        requestUrl: 'https://example.com',
        responseUrl: 'https://example.com',
        redirected: false,
        requestMethod: 'GET',
        requestHeaders: {},
        responseHeaders: { 'content-type': 'text/plain' },
        body: 'hello',
      },
      undefined,
      { outputResponseHeaders: 'false' as unknown as boolean, outputResponseBody: 'false' as unknown as boolean },
    );

    expect(json.headers).toEqual({ 'content-type': 'text/plain' });
    expect(json.body).toBe('hello');
  });
});
