import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createExecutorRegistry } from '../../registry/executor-registry.js';
import { registerPlusExecutors } from '../register-plus.js';
import { splitInBatchesExecutor } from './split-in-batches.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const auditRowPath = join(repoRoot, 'docs/test/node-audit-rows/splitInBatches.md');

describe('splitInBatches registry', () => {
  it('throws E2003 when splitInBatches executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('splitInBatches', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('splitInBatches')).toBe(true);
  });
});

describe('splitInBatches M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(auditRowPath)).toBe(true);
    const content = readFileSync(auditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-splitInBatches');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-splitInBatches');
  });
});

describe('splitInBatchesExecutor', () => {
  it('splits input items into batches by batchSize', async () => {
    const items = [
      { json: { i: 1 } },
      { json: { i: 2 } },
      { json: { i: 3 } },
      { json: { i: 4 } },
      { json: { i: 5 } },
    ];
    const result = await splitInBatchesExecutor.execute({
      config: { batchSize: 2 },
      inputItems: items,
    });

    expect(result.status).toBe('success');
    expect(result.outputItems).toHaveLength(3);
    expect(result.outputItems?.[0]).toHaveLength(2);
    expect(result.outputItems?.[0]?.[0]?.json).toEqual({ i: 1 });
    expect(result.outputItems?.[1]?.[0]?.json).toEqual({ i: 3 });
    expect(result.outputItems?.[2]).toHaveLength(1);
    expect(result.outputItems?.[2]?.[0]?.json).toEqual({ i: 5 });
  });

  it('defaults batchSize to 1 when omitted', async () => {
    const items = [{ json: { a: 1 } }, { json: { a: 2 } }];
    const result = await splitInBatchesExecutor.execute({
      config: {},
      inputItems: items,
    });

    expect(result.status).toBe('success');
    expect(result.outputItems).toHaveLength(2);
    expect(result.outputItems?.[0]).toHaveLength(1);
    expect(result.outputItems?.[1]).toHaveLength(1);
  });

  it('returns a single empty branch when input is empty', async () => {
    const result = await splitInBatchesExecutor.execute({
      config: { batchSize: 2 },
      inputItems: [],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems).toEqual([[]]);
  });

  it('clamps invalid batchSize to at least 1', async () => {
    const items = [{ json: { x: 1 } }, { json: { x: 2 } }];
    const result = await splitInBatchesExecutor.execute({
      config: { batchSize: 0 },
      inputItems: items,
    });

    expect(result.status).toBe('success');
    expect(result.outputItems).toHaveLength(2);
  });
});
