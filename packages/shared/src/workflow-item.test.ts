import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/** Mirrors docs/architecture/binary-current-state.test.mjs B-6 gate for vitest. */
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
import type { BinaryAttachment, BinaryBlobRef, BinaryMap } from './binary-map.js';
import {
  isBinaryAttachment,
  isBinaryMap,
  mergeBinaryMaps,
} from './binary-map.js';
import type { WorkflowItem } from './workflow-item.js';
import {
  createWorkflowItem,
  hasBinary,
  isWorkflowItem,
} from './workflow-item.js';

describe('M-5 B-6 implementation gate', () => {
  it('allows binary implementation tests after B-6 cleared', () => {
    expect(() => assertM5BinaryImplementationAllowed()).not.toThrow();
  });
});

describe('BinaryMap types (design §3.1)', () => {
  it('accepts inline attachment with optional fileName and fileSize', () => {
    const att: BinaryAttachment = {
      data: Buffer.from('hello').toString('base64'),
      mimeType: 'text/plain',
      fileName: 'hello.txt',
      fileSize: 5,
    };
    expect(isBinaryAttachment(att)).toBe(true);
  });

  it('accepts externalized attachment with blob ref and empty data', () => {
    const ref: BinaryBlobRef = { blobId: 'blob-1' };
    const att: BinaryAttachment = {
      data: '',
      mimeType: 'application/octet-stream',
      fileSize: 1024,
      ref,
    };
    expect(isBinaryAttachment(att)).toBe(true);
    expect(att.ref?.blobId).toBe('blob-1');
  });

  it('rejects invalid attachment shapes', () => {
    expect(isBinaryAttachment(null)).toBe(false);
    expect(isBinaryAttachment({ data: 1, mimeType: 'x' })).toBe(false);
    expect(isBinaryAttachment({ data: 'a' })).toBe(false);
  });

  it('validates BinaryMap as record of attachments', () => {
    const map: BinaryMap = {
      data: { data: 'aGVsbG8=', mimeType: 'text/plain', fileSize: 5 },
      file: { data: '', mimeType: 'image/png', ref: { blobId: 'b2' } },
    };
    expect(isBinaryMap(map)).toBe(true);
    expect(isBinaryMap({ bad: { data: 1, mimeType: 'x' } })).toBe(false);
    expect(isBinaryMap([])).toBe(false);
  });

  it('merges binary maps without dropping keys', () => {
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

describe('WorkflowItem.binary', () => {
  it('json-only item satisfies WorkflowItem', () => {
    const item = createWorkflowItem({ id: 1 });
    expect(isWorkflowItem(item)).toBe(true);
    expect(hasBinary(item)).toBe(false);
  });

  it('carries optional binary map for node pass-through (AC-047 type layer)', () => {
    const item: WorkflowItem = createWorkflowItem(
      { status: 'ok' },
      {
        payload: {
          data: Buffer.from('raw').toString('base64'),
          mimeType: 'application/octet-stream',
          fileName: 'payload.bin',
          fileSize: 3,
        },
      },
    );
    expect(isWorkflowItem(item)).toBe(true);
    expect(hasBinary(item)).toBe(true);
    expect(item.binary?.payload?.fileName).toBe('payload.bin');
  });
});
