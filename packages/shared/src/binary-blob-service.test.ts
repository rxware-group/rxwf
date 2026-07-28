import { describe, it, expect } from 'vitest';
import {
  createBinaryBlobService,
  createBinaryBlobServiceFromEnv,
  STANDARD_BINARY_BLOB_PLAN,
  type BinaryBlobStore,
} from './binary-blob-service.js';
import {
  DEFAULT_BINARY_INLINE_MAX_BYTES,
  DEFAULT_BINARY_ITEM_MAX_BYTES,
  encodeBinaryBuffer,
} from './binary/binary-utils.js';
import type { BinaryAttachment } from './item.js';

function createMemoryBlobStore(): BinaryBlobStore & { blobs: Map<string, Buffer> } {
  const blobs = new Map<string, Buffer>();
  return {
    blobs,
    async store(params) {
      const blobId = crypto.randomUUID();
      blobs.set(blobId, params.buffer);
      return { blobId };
    },
    async load(blobId) {
      const buf = blobs.get(blobId);
      if (!buf) throw new Error(`blob not found: ${blobId}`);
      return buf;
    },
  };
}

function expectAttachment(
  value: BinaryAttachment | undefined,
): BinaryAttachment {
  expect(value).toBeDefined();
  return value as BinaryAttachment;
}

describe('createBinaryBlobService', () => {
  it('keeps small attachments inline below 256 KiB threshold', async () => {
    const store = createMemoryBlobStore();
    const service = createBinaryBlobService(store);
    const small = Buffer.alloc(1024, 1);
    const item = {
      json: { ok: true },
      binary: {
        file: encodeBinaryBuffer(small, 'application/octet-stream', {
          fileName: 'small.bin',
        }),
      },
    };
    const externalized = await service.externalizeItem(item, {
      executionId: 'ex-1',
      nodeRunId: 'nr-1',
    });
    const file = expectAttachment(externalized.binary?.file);
    expect(file.data).not.toBe('');
    expect(file.ref).toBeUndefined();
    expect(store.blobs.size).toBe(0);
  });

  it('externalizes attachments above inline threshold with ref.blobId', async () => {
    const store = createMemoryBlobStore();
    const service = createBinaryBlobService(store);
    const large = Buffer.alloc(DEFAULT_BINARY_INLINE_MAX_BYTES + 1, 2);
    const item = {
      json: {},
      binary: {
        file: encodeBinaryBuffer(large, 'application/octet-stream'),
      },
    };
    const externalized = await service.externalizeItem(item, {
      executionId: 'ex-1',
      nodeRunId: 'nr-1',
    });
    const file = expectAttachment(externalized.binary?.file);
    expect(file.data).toBe('');
    expect(file.ref?.blobId).toBeTruthy();
    expect(store.blobs.size).toBe(1);
  });

  it('hydrates ref.blobId back to inline data', async () => {
    const store = createMemoryBlobStore();
    const service = createBinaryBlobService(store);
    const payload = Buffer.from('hydrate-me');
    const { blobId } = await store.store({
      executionId: 'ex-1',
      kind: 'output',
      buffer: payload,
    });
    const hydrated = await service.hydrateItem({
      json: {},
      binary: {
        file: {
          data: '',
          mimeType: 'text/plain',
          ref: { blobId },
        },
      },
    });
    const file = expectAttachment(hydrated.binary?.file);
    expect(file.data).toBe(payload.toString('base64'));
    expect(file.fileSize).toBe(payload.length);
  });

  it('rejects items exceeding 32 MiB binary limit with E2002', async () => {
    const store = createMemoryBlobStore();
    const service = createBinaryBlobService(store);
    const tooLarge = Buffer.alloc(DEFAULT_BINARY_ITEM_MAX_BYTES + 1, 3);
    const item = {
      json: {},
      binary: {
        file: encodeBinaryBuffer(tooLarge, 'application/octet-stream'),
      },
    };
    await expect(
      service.externalizeItem(item, {
        executionId: 'ex-1',
        nodeRunId: 'nr-1',
      }),
    ).rejects.toMatchObject({ code: 'E2002' });
  });

  it('externalizeOutputItems processes all branches', async () => {
    const store = createMemoryBlobStore();
    const service = createBinaryBlobService(store);
    const large = Buffer.alloc(DEFAULT_BINARY_INLINE_MAX_BYTES + 1, 4);
    const outputItems = [
      [
        {
          json: { branch: 0 },
          binary: {
            a: encodeBinaryBuffer(large, 'application/octet-stream'),
          },
        },
      ],
      [
        {
          json: { branch: 1 },
          binary: {
            b: encodeBinaryBuffer(Buffer.from('small'), 'text/plain'),
          },
        },
      ],
    ];
    const externalized = await service.externalizeOutputItems(outputItems, {
      executionId: 'ex-1',
      nodeRunId: 'nr-1',
    });
    const branch0 = externalized[0]?.[0];
    const branch1 = externalized[1]?.[0];
    expect(branch0).toBeDefined();
    expect(branch1).toBeDefined();
    const a = expectAttachment(branch0!.binary?.a);
    const b = expectAttachment(branch1!.binary?.b);
    expect(a.data).toBe('');
    expect(a.ref?.blobId).toBeTruthy();
    expect(b.data).not.toBe('');
    expect(store.blobs.size).toBe(1);
  });
});

describe('createBinaryBlobServiceFromEnv', () => {
  it('reads RXWF_BINARY_INLINE_MAX_BYTES when set', async () => {
    const prev = process.env.RXWF_BINARY_INLINE_MAX_BYTES;
    process.env.RXWF_BINARY_INLINE_MAX_BYTES = '512';
    try {
      const store = createMemoryBlobStore();
      const service = createBinaryBlobServiceFromEnv(store);
      const buf = Buffer.alloc(600, 5);
      const externalized = await service.externalizeItem(
        {
          json: {},
          binary: { f: encodeBinaryBuffer(buf, 'application/octet-stream') },
        },
        { executionId: 'ex-1', nodeRunId: 'nr-1' },
      );
      const f = expectAttachment(externalized.binary?.f);
      expect(f.data).toBe('');
      expect(f.ref?.blobId).toBeTruthy();
    } finally {
      if (prev === undefined) delete process.env.RXWF_BINARY_INLINE_MAX_BYTES;
      else process.env.RXWF_BINARY_INLINE_MAX_BYTES = prev;
    }
  });
});

describe('STANDARD_BINARY_BLOB_PLAN', () => {
  it('documents Standard profile blob gap for M-5', () => {
    expect(STANDARD_BINARY_BLOB_PLAN.profile).toBe('standard');
    expect(STANDARD_BINARY_BLOB_PLAN.status).toBe('planned');
    expect(STANDARD_BINARY_BLOB_PLAN.table).toBe('execution_blobs');
  });
});
