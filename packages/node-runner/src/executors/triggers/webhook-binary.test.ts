import { describe, expect, it } from 'vitest';
import {
  parseWebhookMultipartBody,
  webhookBinaryItemsFromBody,
} from './webhook-binary.js';

function multipartBody(
  boundary: string,
  parts: Array<{ headers: string[]; body: string }>,
): Buffer {
  const chunks = parts.flatMap((part) => [
    `--${boundary}`,
    ...part.headers,
    '',
    part.body,
  ]);
  chunks.push(`--${boundary}--`, '');
  return Buffer.from(chunks.join('\r\n'));
}

describe('parseWebhookMultipartBody (CONF-05: form field name → binary key)', () => {
  it('maps text fields to json and file fields to binary keyed by field name', () => {
    const boundary = '----rxwf-binary';
    const rawBody = multipartBody(boundary, [
      {
        headers: ['Content-Disposition: form-data; name="title"'],
        body: 'hello',
      },
      {
        headers: [
          'Content-Disposition: form-data; name="upload"; filename="a.txt"',
          'Content-Type: text/plain',
        ],
        body: 'file-content',
      },
    ]);
    const items = parseWebhookMultipartBody(rawBody, `multipart/form-data; boundary=${boundary}`);
    expect(items).toHaveLength(1);
    expect(items[0]?.json).toEqual({ title: 'hello' });
    expect(items[0]?.binary?.upload?.mimeType).toBe('text/plain');
    expect(items[0]?.binary?.upload?.fileName).toBe('a.txt');
    const uploadData = items[0]?.binary?.upload?.data;
    expect(uploadData).toBeTruthy();
    expect(Buffer.from(uploadData!, 'base64').toString()).toBe('file-content');
  });

  it('supports multiple file fields with distinct binary keys', () => {
    const boundary = '----rxwf-multi';
    const rawBody = multipartBody(boundary, [
      {
        headers: [
          'Content-Disposition: form-data; name="avatar"; filename="a.png"',
          'Content-Type: image/png',
        ],
        body: 'png-bytes',
      },
      {
        headers: [
          'Content-Disposition: form-data; name="attachment"; filename="b.pdf"',
          'Content-Type: application/pdf',
        ],
        body: 'pdf-bytes',
      },
    ]);
    const items = parseWebhookMultipartBody(rawBody, `multipart/form-data; boundary=${boundary}`);
    expect(Object.keys(items[0]?.binary ?? {}).sort()).toEqual(['attachment', 'avatar']);
    const avatarData = items[0]?.binary?.avatar?.data;
    const attachmentData = items[0]?.binary?.attachment?.data;
    expect(Buffer.from(avatarData!, 'base64').toString()).toBe('png-bytes');
    expect(Buffer.from(attachmentData!, 'base64').toString()).toBe('pdf-bytes');
  });

  it('returns empty json when boundary is missing', () => {
    const items = parseWebhookMultipartBody(Buffer.from('x'), 'multipart/form-data');
    expect(items).toEqual([{ json: {} }]);
  });
});

describe('webhookBinaryItemsFromBody', () => {
  it('delegates multipart to parseWebhookMultipartBody', () => {
    const boundary = '----rxwf-delegate';
    const rawBody = multipartBody(boundary, [
      {
        headers: [
          'Content-Disposition: form-data; name="doc"; filename="x.bin"',
          'Content-Type: application/octet-stream',
        ],
        body: '\x01\x02',
      },
    ]);
    const items = webhookBinaryItemsFromBody({
      rawBody,
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
    expect(items[0]?.binary?.doc?.mimeType).toBe('application/octet-stream');
  });
});
