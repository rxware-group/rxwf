import { describe, expect, it } from 'vitest';
import { applySetBinaryToItem, splitResolvedSetFields } from './set-binary.js';

describe('splitResolvedSetFields', () => {
  it('routes binary attachments to binary map', () => {
    const attachment = {
      data: 'aGVsbG8=',
      mimeType: 'text/plain',
      fileSize: 5,
    };
    const out = splitResolvedSetFields({
      status: 'ok',
      upload: attachment,
    });
    expect(out.json).toEqual({ status: 'ok' });
    expect(out.binary).toEqual({ upload: attachment });
  });

  it('treats all-binary object as BinaryMap', () => {
    const attachment = {
      data: 'aGVsbG8=',
      mimeType: 'text/plain',
      fileSize: 5,
    };
    const out = splitResolvedSetFields({ data: attachment });
    expect(out.json).toEqual({});
    expect(out.binary).toEqual({ data: attachment });
  });
});

describe('applySetBinaryToItem', () => {
  it('merges json fields and preserves existing binary', () => {
    const attachment = {
      data: Buffer.from('x').toString('base64'),
      mimeType: 'application/octet-stream',
      fileSize: 1,
    };
    const out = applySetBinaryToItem(
      { json: { id: 1 }, binary: { data: attachment } },
      { status: 'ready' },
    );
    expect(out.json).toEqual({ id: 1, status: 'ready' });
    expect(out.binary?.data).toEqual(attachment);
  });

  it('merges new binary attachment from resolved fields', () => {
    const existing = {
      data: Buffer.from('old').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 3,
    };
    const upload = {
      data: Buffer.from('new').toString('base64'),
      mimeType: 'image/png',
      fileSize: 3,
    };
    const out = applySetBinaryToItem(
      { json: {}, binary: { data: existing } },
      { upload },
    );
    expect(out.binary?.data).toEqual(existing);
    expect(out.binary?.upload).toEqual(upload);
  });
});
