import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { compileGrepRegex, invokeGrep } from './grep.js';

describe('invokeGrep', () => {
  it('returns empty matches array when pattern has no hits', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-grep-'));
    await writeFile(join(tmp, 'sample.txt'), 'hello world\n', 'utf8');

    const result = await invokeGrep(
      { pattern: 'no-such-token', path: tmp },
      { scanRoots: [tmp] },
    );

    expect(result.matches).toEqual([]);
  });

  it('throws E2002 for invalid regex when patternType is regex', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-grep-'));
    await writeFile(join(tmp, 'sample.txt'), 'hello\n', 'utf8');

    await expect(
      invokeGrep(
        { pattern: '[invalid', path: tmp, patternType: 'regex' },
        { scanRoots: [tmp] },
      ),
    ).rejects.toMatchObject({ code: 'E2002' });
  });

  it('finds matches for literal patternType', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-grep-'));
    await writeFile(join(tmp, 'data.txt'), 'needle here\n', 'utf8');

    const result = await invokeGrep(
      { pattern: 'needle', path: tmp, patternType: 'literal' },
      { scanRoots: [tmp] },
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.text).toContain('needle');
  });
});

describe('compileGrepRegex', () => {
  it('throws E2002 for invalid regex pattern', () => {
    expect(() => compileGrepRegex('[bad', { patternType: 'regex' })).toThrow(
      expect.objectContaining({ code: 'E2002' }),
    );
  });
});
