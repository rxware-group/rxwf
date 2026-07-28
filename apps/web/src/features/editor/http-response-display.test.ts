import { describe, expect, it } from 'vitest';
import {
  formatHttpOutputBodiesForDisplay,
  formatHttpResponseBodyForDisplay,
  resolveHttpOutputBodyPreview,
} from './http-response-display.js';

describe('http-response-display', () => {
  it('formats JSON body objects with indentation', () => {
    expect(formatHttpResponseBodyForDisplay({ ok: true }, 'json')).toBe(
      '{\n  "ok": true\n}',
    );
  });

  it('keeps HTML body as plain text', () => {
    expect(formatHttpResponseBodyForDisplay('<html></html>', 'html')).toBe('<html></html>');
  });

  it('formats multiple bodies for text content types', () => {
    expect(formatHttpOutputBodiesForDisplay(['a', 'b'], 'plaintext')).toBe(
      '# Item 1\na\n\n# Item 2\nb',
    );
  });

  it('formats body preview from output data', () => {
    expect(
      resolveHttpOutputBodyPreview([{ body: 'hello' }], { responseBodyContentType: 'plaintext' })
        .text,
    ).toBe('hello');
  });

  it('uses selected response body type for display', () => {
    expect(
      resolveHttpOutputBodyPreview([{ body: '{"a":1}' }], {
        responseBodyContentType: 'json',
      }).text,
    ).toBe('{\n  "a": 1\n}');
  });
});
