import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateJsExpression } from './js-sandbox/evaluate-js.js';
import {
  coerceExpressionBinaryResult,
  isExpressionBinaryResult,
  readBinaryAttachment,
  resolveBinaryGlobal,
} from './binary-globals.js';

function assertM5BinaryImplementationAllowed(): void {
  const docPath = resolve(
    import.meta.dirname,
    '../../../docs/architecture/binary-current-state.md',
  );
  const content = readFileSync(docPath, 'utf8');
  const match = content.match(/^m5BinaryPlanGate:\s*(\S+)/m);
  if (!match || match[1] !== 'cleared') {
    throw new Error(
      'B-6 未通过 — m5BinaryPlanGate blocked; M-5 binary implementation tests must fail until user confirms plan (T-103)',
    );
  }
}

const sampleBinary = {
  data: {
    data: Buffer.from('hello').toString('base64'),
    mimeType: 'text/plain',
    fileName: 'hello.txt',
    fileSize: 5,
  },
};

describe('M-5 B-6 implementation gate', () => {
  it('allows binary globals tests after B-6 cleared', () => {
    expect(() => assertM5BinaryImplementationAllowed()).not.toThrow();
  });
});

describe('resolveBinaryGlobal (read)', () => {
  it('prefers context.binary when set', () => {
    expect(resolveBinaryGlobal({ json: {}, binary: sampleBinary })).toEqual(
      sampleBinary,
    );
  });

  it('falls back to input item at itemIndex', () => {
    expect(
      resolveBinaryGlobal({
        json: {},
        input: [{ json: { id: 1 }, binary: sampleBinary }, { json: { id: 2 } }],
        itemIndex: 0,
      }),
    ).toEqual(sampleBinary);
  });

  it('returns undefined when no binary on context or input', () => {
    expect(resolveBinaryGlobal({ json: {}, input: [{ json: {} }] })).toBeUndefined();
  });
});

describe('readBinaryAttachment (read)', () => {
  it('returns named attachment defaulting to data', () => {
    const map = {
      data: { data: 'x', mimeType: 'text/plain', fileSize: 1 },
      file: { data: 'y', mimeType: 'image/png', fileSize: 2 },
    };
    expect(readBinaryAttachment(map)).toEqual(map.data);
    expect(readBinaryAttachment(map, 'file')).toEqual(map.file);
    expect(readBinaryAttachment(undefined)).toBeUndefined();
    expect(readBinaryAttachment(map, 'missing')).toBeUndefined();
  });
});

describe('$binary expression read (AC-050)', () => {
  it('reads $binary.data.fileSize for IF conditions', async () => {
    const v = await evaluateJsExpression('return $binary.data.fileSize > 0', {
      json: {},
      binary: {
        data: {
          data: 'cGF5bG9hZA==',
          mimeType: 'application/octet-stream',
          fileSize: 7,
        },
      },
    });
    expect(v).toBe(true);
  });

  it('reads $binary.data.mimeType and fileName', async () => {
    const v = await evaluateJsExpression(
      'return $binary.data.mimeType + ":" + ($binary.data.fileName ?? "")',
      { json: {}, binary: sampleBinary },
    );
    expect(v).toBe('text/plain:hello.txt');
  });

  it('reads externalized binary ref without inline data', async () => {
    const v = await evaluateJsExpression('return $binary.data.ref?.blobId', {
      json: {},
      binary: {
        data: {
          data: '',
          mimeType: 'application/octet-stream',
          fileSize: 1024,
          ref: { blobId: 'blob-42' },
        },
      },
    });
    expect(v).toBe('blob-42');
  });

  it('reads binary via $input.item.binary', async () => {
    const v = await evaluateJsExpression('return $input.item.binary?.data?.mimeType', {
      json: {},
      input: [
        {
          json: {},
          binary: { data: { data: 'x', mimeType: 'image/png', fileSize: 1 } },
        },
      ],
      itemIndex: 0,
    });
    expect(v).toBe('image/png');
  });

  it('lists binary keys with Object.keys', async () => {
    const v = await evaluateJsExpression('return Object.keys($binary ?? {})', {
      json: {},
      binary: sampleBinary,
    });
    expect(v).toEqual(['data']);
  });
});

describe('coerceExpressionBinaryResult (write)', () => {
  it('accepts valid BinaryMap from expression', () => {
    const map = {
      upload: { data: 'aGVsbG8=', mimeType: 'text/plain', fileSize: 5 },
    };
    expect(coerceExpressionBinaryResult(map)).toEqual(map);
    expect(isExpressionBinaryResult(map)).toBe(true);
  });

  it('wraps single BinaryAttachment under data key', () => {
    const att = { data: 'x', mimeType: 'text/plain', fileSize: 1 };
    expect(coerceExpressionBinaryResult(att)).toEqual({ data: att });
  });

  it('returns undefined for invalid shapes', () => {
    expect(coerceExpressionBinaryResult(null)).toBeUndefined();
    expect(coerceExpressionBinaryResult('not-binary')).toBeUndefined();
    expect(
      coerceExpressionBinaryResult({ bad: { data: 1, mimeType: 'x' } }),
    ).toBeUndefined();
    expect(isExpressionBinaryResult({ bad: { data: 1, mimeType: 'x' } })).toBe(false);
  });
});

describe('$binary expression write (AC-050)', () => {
  it('returns BinaryMap object from expression for Set merge', async () => {
    const v = await evaluateJsExpression(
      `return {
        upload: { data: 'aGVsbG8=', mimeType: 'text/plain', fileSize: 5 },
      }`,
      { json: {} },
    );
    expect(coerceExpressionBinaryResult(v)).toEqual({
      upload: { data: 'aGVsbG8=', mimeType: 'text/plain', fileSize: 5 },
    });
  });

  it('returns $binary for passthrough merge', async () => {
    const v = await evaluateJsExpression('return $binary', {
      json: { ok: true },
      binary: sampleBinary,
    });
    expect(coerceExpressionBinaryResult(v)).toEqual(sampleBinary);
  });
});
