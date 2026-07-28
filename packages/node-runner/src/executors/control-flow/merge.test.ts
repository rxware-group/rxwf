import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerBuiltinExecutors } from '../register-builtin.js';
import { mergeExecutor } from './merge.js';

describe('mergeExecutor', () => {
  it('append mode concatenates input item arrays from config branches', async () => {
    const result = await mergeExecutor.execute({
      config: { mode: 'append' },
      inputItems: [],
      inputBranches: [[{ json: { a: 1 } }], [{ json: { b: 2 } }]],
    });
    expect(result.outputItems?.[0]).toEqual([
      { json: { a: 1 } },
      { json: { b: 2 } },
    ]);
  });

  it('append mode preserves binary on each item', async () => {
    const attachment = {
      data: Buffer.from('x').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 1,
    };
    const result = await mergeExecutor.execute({
      config: { mode: 'append' },
      inputItems: [],
      inputBranches: [
        [{ json: { a: 1 }, binary: { data: attachment } }],
        [{ json: { b: 2 } }],
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.binary?.data).toEqual(attachment);
  });

  it('combineByKey merges items with same matchField across branches', async () => {
    const result = await mergeExecutor.execute({
      config: { mode: 'combineByKey', matchField: 'id' },
      inputItems: [],
      inputBranches: [
        [{ json: { id: 'x', a: 1 } }],
        [{ json: { id: 'x', b: 2 } }, { json: { id: 'y', c: 3 } }],
      ],
    });
    expect(result.outputItems?.[0]).toEqual([
      { json: { id: 'x', a: 1, b: 2 } },
      { json: { id: 'y', c: 3 } },
    ]);
  });

  it('combineByKey keeps first non-empty binary for matched items', async () => {
    const firstBinary = {
      data: Buffer.from('first').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 5,
    };
    const secondBinary = {
      data: Buffer.from('second').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 6,
    };
    const result = await mergeExecutor.execute({
      config: { mode: 'combineByKey', matchField: 'id' },
      inputItems: [],
      inputBranches: [
        [{ json: { id: 'x', a: 1 }, binary: { data: firstBinary } }],
        [{ json: { id: 'x', b: 2 }, binary: { data: secondBinary } }],
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ id: 'x', a: 1, b: 2 });
    expect(result.outputItems?.[0]?.[0]?.binary?.data).toEqual(firstBinary);
  });

  it('combineAll wraps each branch item list under json.branches', async () => {
    const result = await mergeExecutor.execute({
      config: { mode: 'combineAll' },
      inputItems: [],
      inputBranches: [
        [{ json: { a: 1 } }],
        [{ json: { b: 2 } }, { json: { c: 3 } }],
      ],
    });
    expect(result.outputItems?.[0]).toEqual([
      {
        json: {
          branches: [[{ a: 1 }], [{ b: 2 }, { c: 3 }]],
        },
      },
    ]);
  });

  it('combineAll preserves upstream binary from all branches (GAP-01)', async () => {
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
    const result = await mergeExecutor.execute({
      config: { mode: 'combineAll' },
      inputItems: [],
      inputBranches: [
        [{ json: { a: 1 }, binary: { data: attachmentA } }],
        [{ json: { b: 2 }, binary: { upload: attachmentB } }],
      ],
    });
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({
      branches: [[{ a: 1 }], [{ b: 2 }]],
    });
    expect(result.outputItems?.[0]?.[0]?.binary?.data).toEqual(attachmentA);
    expect(result.outputItems?.[0]?.[0]?.binary?.upload).toEqual(attachmentB);
  });

  it('combineByKey with empty branches returns empty output', async () => {
    const result = await mergeExecutor.execute({
      config: { mode: 'combineByKey', matchField: 'id' },
      inputItems: [],
      inputBranches: [[], []],
    });
    expect(result.outputItems?.[0]).toEqual([]);
  });

  it('is registered via registerBuiltinExecutors', () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('merge')).toBe(true);
  });

  it('combineByKey throws E2002 when matchField is empty', async () => {
    await expect(
      mergeExecutor.execute({
        config: { mode: 'combineByKey', matchField: '  ' },
        inputItems: [],
        inputBranches: [[{ json: { id: 'x' } }]],
      }),
    ).rejects.toMatchObject({ code: 'E2002', message: /matchField/i });
  });

  it('unsupported mode returns failed with E2002', async () => {
    const result = await mergeExecutor.execute({
      config: { mode: 'unknown-mode' },
      inputItems: [],
      inputBranches: [[{ json: { a: 1 } }]],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.errorMessage).toMatch(/Unsupported merge mode/i);
  });
});
