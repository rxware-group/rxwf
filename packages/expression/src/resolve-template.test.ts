import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import {
  hasTemplateSyntax,
  resolveTemplateJson,
  resolveTemplateString,
  resolveTemplateValue,
} from './resolve-template.js';

const ctx = {
  json: { id: 42, name: 'alice' },
  env: { API_URL: 'https://api.example.com' },
};

describe('resolveTemplateString', () => {
  it('returns plain strings unchanged', async () => {
    await expect(resolveTemplateString('https://static.example', ctx)).resolves.toBe(
      'https://static.example',
    );
  });

  it('resolves full {{ }} templates', async () => {
    await expect(resolveTemplateString('{{ $env.API_URL }}', ctx)).resolves.toBe(
      'https://api.example.com',
    );
  });

  it('resolves n8n ={{ }} templates', async () => {
    await expect(resolveTemplateString('={{ $json.id }}', ctx)).resolves.toBe('42');
  });

  it('resolves embedded templates in URLs', async () => {
    await expect(
      resolveTemplateString('{{ $env.API_URL }}/users/{{ $json.id }}', ctx),
    ).resolves.toBe('https://api.example.com/users/42');
  });

  it('resolves embedded $itemIndex in file paths', async () => {
    await expect(
      resolveTemplateString('C:/data/{{ $itemIndex }}.html', { json: {}, itemIndex: 2 }),
    ).resolves.toBe('C:/data/2.html');
  });

  it('resolves embedded $itemIndex in Windows-style paths', async () => {
    await expect(
      resolveTemplateString('C:\\data\\{{ $itemIndex }}.html', { json: {}, itemIndex: 2 }),
    ).resolves.toBe('C:\\data\\2.html');
  });
});

describe('resolveTemplateValue', () => {
  it('resolves templates in object field values', async () => {
    await expect(
      resolveTemplateValue(
        { url: '{{ $env.API_URL }}', id: '{{ $json.id }}' },
        ctx,
      ),
    ).resolves.toEqual({ url: 'https://api.example.com', id: '42' });
  });

  it('preserves object results for full ={{ }} field expressions', async () => {
    const binaryCtx = {
      ...ctx,
      binary: {
        data: {
          data: 'aGVsbG8=',
          mimeType: 'text/plain',
          fileSize: 5,
        },
      },
    };
    await expect(
      resolveTemplateValue('={{ $binary.data }}', binaryCtx),
    ).resolves.toEqual({
      data: 'aGVsbG8=',
      mimeType: 'text/plain',
      fileSize: 5,
    });
  });
});

describe('resolveTemplateJson', () => {
  it('parses JSON with embedded templates', async () => {
    await expect(
      resolveTemplateJson(
        '{ "url": "{{ $env.API_URL }}", "user": "{{ $json.name }}" }',
        ctx,
      ),
    ).resolves.toEqual({ url: 'https://api.example.com', user: 'alice' });
  });

  it('evaluates full expression templates to objects', async () => {
    await expect(resolveTemplateJson('={{ $json }}', ctx)).resolves.toEqual(ctx.json);
  });

  it('wraps non-object expression results', async () => {
    await expect(resolveTemplateJson('={{ $json.id }}', ctx)).resolves.toEqual({
      value: 42,
    });
  });

  it('throws on invalid JSON without templates', async () => {
    await expect(() => resolveTemplateJson('{ bad', ctx)).rejects.toThrow(AwfError);
  });
});

describe('hasTemplateSyntax', () => {
  it('detects embedded and full templates', () => {
    expect(hasTemplateSyntax('{{ $json.a }}')).toBe(true);
    expect(hasTemplateSyntax('https://x/{{ $json.a }}')).toBe(true);
    expect(hasTemplateSyntax('plain')).toBe(false);
  });

  it('does not poison global regex lastIndex for a follow-up resolve', async () => {
    const path = 'C:\\data\\{{ $itemIndex }}.html';
    expect(hasTemplateSyntax(path)).toBe(true);
    await expect(resolveTemplateString(path, { json: {}, itemIndex: 3 })).resolves.toBe(
      'C:\\data\\3.html',
    );
  });
});
