import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { hasTemplateSyntax, resolveTemplateString } from '@rxwf/expression';
import { resolveConfigStringField } from './resolve-config-string-field.js';

describe('resolveConfigStringField', () => {
  it('detects embedded templates after Windows path separators', () => {
    const path = join(tmpdir(), '{{ $itemIndex }}.html');
    expect(hasTemplateSyntax(path)).toBe(true);
  });

  it('resolveTemplateString works after hasTemplateSyntax on Windows paths', async () => {
    const path = join(tmpdir(), 'rxwf-double-check', '{{ $itemIndex }}.html');
    expect(hasTemplateSyntax(path)).toBe(true);
    await expect(
      resolveTemplateString(path, { json: {}, itemIndex: 1 }),
    ).resolves.toBe(join(tmpdir(), 'rxwf-double-check', '1.html'));
  });

  it('resolves embedded $itemIndex in template paths', async () => {
    const dir = join(tmpdir(), 'rxwf-resolve-test');
    const path = join(dir, '{{ $itemIndex }}.html');
    const resolved = await resolveConfigStringField(
      {},
      'path',
      path,
      { json: {}, itemIndex: 1 },
    );
    expect(resolved).toBe(join(dir, '1.html'));
  });

  it('preserves plain newlines without templates', async () => {
    const resolved = await resolveConfigStringField(
      {},
      'content',
      'line1\n',
      { json: {} },
    );
    expect(resolved).toBe('line1\n');
  });
});
