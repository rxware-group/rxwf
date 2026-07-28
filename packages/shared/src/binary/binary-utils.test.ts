import { describe, it, expect } from 'vitest';
import {
  decodeBinaryData,
  encodeBinaryBuffer,
  isBinaryMap,
  mergeBinaryMaps,
  withJsonPreservingBinary,
} from './binary-utils.js';

describe('binary utils', () => {
  it('round-trips buffer through base64', () => {
    const att = encodeBinaryBuffer(Buffer.from('hello'), 'text/plain');
    expect(decodeBinaryData(att).toString()).toBe('hello');
    expect(att.fileSize).toBe(5);
  });

  it('detects binary map shape', () => {
    expect(
      isBinaryMap({ data: { data: 'a', mimeType: 'text/plain' } }),
    ).toBe(true);
    expect(isBinaryMap({ data: { data: 1, mimeType: 'x' } })).toBe(false);
  });

  it('preserves binary when updating json', () => {
    const item = {
      json: { id: 1 },
      binary: { file: { data: 'a', mimeType: 'text/plain' } },
    };
    const out = withJsonPreservingBinary(item, { id: 2, ok: true });
    expect(out.json).toEqual({ id: 2, ok: true });
    expect(out.binary).toEqual(item.binary);
  });

  it('merges binary maps', () => {
    expect(
      mergeBinaryMaps(
        { a: { data: 'x', mimeType: 'text/plain' } },
        { b: { data: 'y', mimeType: 'image/png' } },
      ),
    ).toEqual({
      a: { data: 'x', mimeType: 'text/plain' },
      b: { data: 'y', mimeType: 'image/png' },
    });
  });
});
