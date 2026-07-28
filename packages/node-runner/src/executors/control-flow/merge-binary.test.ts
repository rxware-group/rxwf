import { describe, expect, it } from 'vitest';
import {
  buildCombineAllItem,
  firstNonEmptyBinary,
  mergeBinaryFromBranches,
  mergeJsonItemsWithBinary,
} from './merge-binary.js';

describe('merge-binary CONF-04', () => {
  const attachmentA = {
    data: Buffer.from('branch-a').toString('base64'),
    mimeType: 'text/plain',
    fileSize: 8,
  };
  const attachmentB = {
    data: Buffer.from('branch-b').toString('base64'),
    mimeType: 'text/plain',
    fileSize: 8,
  };
  const attachmentFirst = {
    data: Buffer.from('first').toString('base64'),
    mimeType: 'text/plain',
    fileSize: 5,
  };
  const attachmentSecond = {
    data: Buffer.from('second').toString('base64'),
    mimeType: 'text/plain',
    fileSize: 6,
  };

  describe('firstNonEmptyBinary', () => {
    it('returns first item binary when multiple items have binary', () => {
      const binary = firstNonEmptyBinary([
        { json: { id: 'x' }, binary: { data: attachmentFirst } },
        { json: { id: 'x' }, binary: { data: attachmentSecond } },
      ]);
      expect(binary?.data).toEqual(attachmentFirst);
    });

    it('skips empty binary maps', () => {
      const binary = firstNonEmptyBinary([
        { json: {}, binary: {} },
        { json: {}, binary: { data: attachmentA } },
      ]);
      expect(binary?.data).toEqual(attachmentA);
    });
  });

  describe('mergeJsonItemsWithBinary (combineByKey)', () => {
    it('merges json and keeps first non-empty binary', () => {
      const out = mergeJsonItemsWithBinary([
        { json: { id: 'x', a: 1 }, binary: { data: attachmentFirst } },
        { json: { id: 'x', b: 2 }, binary: { data: attachmentSecond } },
      ]);
      expect(out.json).toEqual({ id: 'x', a: 1, b: 2 });
      expect(out.binary?.data).toEqual(attachmentFirst);
    });
  });

  describe('buildCombineAllItem (combineAll GAP-01)', () => {
    it('wraps branch json and preserves upstream binary from all branches', () => {
      const out = buildCombineAllItem([
        [{ json: { a: 1 }, binary: { data: attachmentA } }],
        [{ json: { b: 2 } }, { json: { c: 3 }, binary: { upload: attachmentB } }],
      ]);
      expect(out.json).toEqual({
        branches: [[{ a: 1 }], [{ b: 2 }, { c: 3 }]],
      });
      expect(out.binary?.data).toEqual(attachmentA);
      expect(out.binary?.upload).toEqual(attachmentB);
    });

    it('returns json-only item when no branch has binary', () => {
      const out = buildCombineAllItem([
        [{ json: { a: 1 } }],
        [{ json: { b: 2 } }],
      ]);
      expect(out.json).toEqual({ branches: [[{ a: 1 }], [{ b: 2 }]] });
      expect(out.binary).toBeUndefined();
    });
  });

  describe('mergeBinaryFromBranches', () => {
    it('merges distinct binary keys across branches', () => {
      const merged = mergeBinaryFromBranches([
        [{ json: {}, binary: { fileA: attachmentA } }],
        [{ json: {}, binary: { fileB: attachmentB } }],
      ]);
      expect(merged).toEqual({ fileA: attachmentA, fileB: attachmentB });
    });
  });
});
