import { describe, expect, it } from 'vitest';
import {
  buildGraphqlRequestBody,
  normalizeHttpBodyContentType,
  normalizeHttpRawBodyContentType,
  rawBodyMimeType,
} from './http-body.js';

describe('http-body', () => {
  it('normalizes legacy json body type to raw', () => {
    expect(normalizeHttpBodyContentType('json')).toBe('raw');
    expect(normalizeHttpRawBodyContentType(undefined, 'json')).toBe('json');
  });

  it('normalizes unknown body type to none', () => {
    expect(normalizeHttpBodyContentType('unknown')).toBe('none');
  });

  it('maps raw content types to mime types', () => {
    expect(rawBodyMimeType('json')).toBe('application/json');
    expect(rawBodyMimeType('text')).toBe('text/plain');
    expect(rawBodyMimeType('xml')).toBe('application/xml');
  });

  it('wraps plain GraphQL query into JSON payload', () => {
    expect(buildGraphqlRequestBody('{ hello }')).toBe(
      JSON.stringify({ query: '{ hello }' }),
    );
    expect(buildGraphqlRequestBody('{"query":"{ hello }"}')).toBe(
      '{"query":"{ hello }"}',
    );
  });
});
