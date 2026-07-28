import { describe, expect, it } from 'vitest';
import { parseWebhookBody } from './parse-webhook-body.js';

describe('parseWebhookBody', () => {
  it('parses JSON body into item json', () => {
    const rawBody = Buffer.from(JSON.stringify({ orderId: '42' }));
    const items = parseWebhookBody({
      rawBody,
      contentType: 'application/json',
    });
    expect(items).toEqual([{ json: { orderId: '42' } }]);
  });

  it('parses octet-stream into binary.data', () => {
    const rawBody = Buffer.from('hello-bytes');
    const items = parseWebhookBody({
      rawBody,
      contentType: 'application/octet-stream',
    });
    expect(items[0]?.json).toEqual({});
    expect(items[0]?.binary?.data?.mimeType).toBe('application/octet-stream');
    expect(Buffer.from(items[0]!.binary!.data.data, 'base64').toString()).toBe(
      'hello-bytes',
    );
  });

  it('parses multipart form with text field and file', () => {
    const boundary = '----rxwf-test';
    const rawBody = Buffer.from(
      [
        `--${boundary}`,
        'Content-Disposition: form-data; name="title"',
        '',
        'hello',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="a.txt"',
        'Content-Type: text/plain',
        '',
        'file-content',
        `--${boundary}--`,
        '',
      ].join('\r\n'),
    );
    const items = parseWebhookBody({
      rawBody,
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
    expect(items[0]?.json).toEqual({ title: 'hello' });
    expect(items[0]?.binary?.file?.mimeType).toBe('text/plain');
    expect(items[0]?.binary?.file?.fileName).toBe('a.txt');
    expect(Buffer.from(items[0]!.binary!.file.data, 'base64').toString()).toBe(
      'file-content',
    );
  });
});
