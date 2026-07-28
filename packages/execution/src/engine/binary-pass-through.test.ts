import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { WorkflowItem } from '@rxwf/shared';
import {
  preserveBinary,
  passThroughBinaryItem,
  passThroughBinaryByIndex,
  passThroughBinaryOnOutput,
} from './binary-pass-through.js';

function assertM5BinaryImplementationAllowed(): void {
  const docPath = resolve(
    import.meta.dirname,
    '../../../../docs/architecture/binary-current-state.md',
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
    data: Buffer.from('payload').toString('base64'),
    mimeType: 'application/octet-stream',
    fileName: 'payload.bin',
    fileSize: 7,
  },
};

function item(json: Record<string, unknown>, binary?: WorkflowItem['binary']): WorkflowItem {
  const out: WorkflowItem = { json };
  if (binary) out.binary = binary;
  return out;
}

describe('M-5 B-6 implementation gate', () => {
  it('allows binary pass-through tests after B-6 cleared', () => {
    expect(() => assertM5BinaryImplementationAllowed()).not.toThrow();
  });
});

describe('preserveBinary (design §4.2)', () => {
  it('keeps input.binary when only json is patched', () => {
    const input = item({ id: 1 }, sampleBinary);
    const out = preserveBinary(input, { json: { id: 2, ok: true } });
    expect(out.json).toEqual({ id: 2, ok: true });
    expect(out.binary).toEqual(sampleBinary);
  });

  it('merges explicit binary patch without dropping existing keys', () => {
    const input = item({ n: 1 }, { a: { data: 'x', mimeType: 'text/plain' } });
    const out = preserveBinary(input, {
      binary: { b: { data: 'y', mimeType: 'image/png' } },
    });
    expect(out.binary).toEqual({
      a: { data: 'x', mimeType: 'text/plain' },
      b: { data: 'y', mimeType: 'image/png' },
    });
  });
});

describe('passThroughBinaryItem (AC-047 execution layer)', () => {
  it('copies upstream binary when output item dropped it', () => {
    const input = item({ x: 1 }, sampleBinary);
    const output = item({ y: 2 });
    expect(passThroughBinaryItem(input, output).binary).toEqual(sampleBinary);
  });

  it('does not overwrite output binary keys', () => {
    const input = item({ x: 1 }, sampleBinary);
    const output = item(
      { y: 2 },
      { data: { data: 'new', mimeType: 'text/plain' } },
    );
    const out = passThroughBinaryItem(input, output);
    expect(out.binary?.data?.data).toBe('new');
  });

  it('fills missing binary keys from input when output is partial', () => {
    const input = item({ x: 1 }, {
      a: { data: 'x', mimeType: 'text/plain' },
      b: { data: 'y', mimeType: 'image/png' },
    });
    const output = item({ y: 2 }, { b: { data: 'z', mimeType: 'image/png' } });
    const out = passThroughBinaryItem(input, output);
    expect(out.binary).toEqual({
      a: { data: 'x', mimeType: 'text/plain' },
      b: { data: 'z', mimeType: 'image/png' },
    });
  });

  it('returns output unchanged when input has no binary', () => {
    const input = item({ x: 1 });
    const output = item({ y: 2 });
    expect(passThroughBinaryItem(input, output)).toEqual(output);
  });
});

describe('passThroughBinaryByIndex', () => {
  it('pairs items by index for multi-item batches', () => {
    const inputItems = [
      item({ i: 0 }, sampleBinary),
      item({ i: 1 }, { file: { data: 'f', mimeType: 'text/plain' } }),
    ];
    const outputItems = [item({ o: 0 }), item({ o: 1 })];
    const out = passThroughBinaryByIndex(inputItems, outputItems);
    expect(out[0]!.binary).toEqual(sampleBinary);
    expect(out[1]!.binary).toEqual({ file: { data: 'f', mimeType: 'text/plain' } });
  });

  it('does not attach binary when output index has no matching input', () => {
    const inputItems = [item({ i: 0 }, sampleBinary)];
    const outputItems = [item({ o: 0 }), item({ o: 1 })];
    const out = passThroughBinaryByIndex(inputItems, outputItems);
    expect(out[0]!.binary).toEqual(sampleBinary);
    expect(out[1]!.binary).toBeUndefined();
  });
});

describe('passThroughBinaryOnOutput (engine node handoff)', () => {
  it('restores binary on main branch when node returned json-only items', () => {
    const inputItems = [item({ seed: true }, sampleBinary)];
    const nodeOutput: WorkflowItem[][] = [[item({ transformed: true })]];
    const fixed = passThroughBinaryOnOutput(inputItems, nodeOutput);
    expect(fixed[0]![0]!.binary).toEqual(sampleBinary);
    expect(fixed[0]![0]!.json).toEqual({ transformed: true });
  });

  it('applies pass-through independently per output branch', () => {
    const inputItems = [item({ x: 1 }, sampleBinary)];
    const nodeOutput: WorkflowItem[][] = [
      [item({ branch: 'true' })],
      [item({ branch: 'false' })],
    ];
    const fixed = passThroughBinaryOnOutput(inputItems, nodeOutput);
    expect(fixed[0]![0]!.binary).toEqual(sampleBinary);
    expect(fixed[1]![0]!.binary).toEqual(sampleBinary);
  });

  it('preserves externalized blob refs through pass-through', () => {
    const refBinary = {
      data: {
        data: '',
        mimeType: 'application/octet-stream',
        fileSize: 4096,
        ref: { blobId: 'blob-ext-1' },
      },
    };
    const inputItems = [item({ id: 1 }, refBinary)];
    const nodeOutput: WorkflowItem[][] = [[item({ id: 2 })]];
    const fixed = passThroughBinaryOnOutput(inputItems, nodeOutput);
    expect(fixed[0]![0]!.binary?.data?.ref).toEqual({ blobId: 'blob-ext-1' });
  });
});
