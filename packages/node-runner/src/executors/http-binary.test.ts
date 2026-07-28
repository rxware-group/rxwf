import { describe, expect, it } from 'vitest';
import {
  applyHttpResponseBinaryToItem,
  buildHttpResponseBinaryFromBuffer,
  normalizeHttpBinaryPropertyName,
  normalizeHttpResponseBinaryMode,
  parseContentDispositionFileName,
  produceHttpResponseBinaryFromResponse,
  shouldAutoDetectBinaryResponse,
  shouldUseBinaryResponseMode,
} from './http-binary.js';

describe('http-binary producer', () => {
  describe('normalizeHttpResponseBinaryMode', () => {
    it('defaults to off when unset (CONF-06)', () => {
      expect(normalizeHttpResponseBinaryMode(undefined)).toBe('off');
      expect(normalizeHttpResponseBinaryMode(null)).toBe('off');
    });

    it('accepts valid modes and falls back to off', () => {
      expect(normalizeHttpResponseBinaryMode('auto')).toBe('auto');
      expect(normalizeHttpResponseBinaryMode('always')).toBe('always');
      expect(normalizeHttpResponseBinaryMode('invalid')).toBe('off');
    });
  });

  describe('normalizeHttpBinaryPropertyName', () => {
    it('defaults to data', () => {
      expect(normalizeHttpBinaryPropertyName(undefined)).toBe('data');
      expect(normalizeHttpBinaryPropertyName('')).toBe('data');
    });

    it('uses custom property name', () => {
      expect(normalizeHttpBinaryPropertyName('file')).toBe('file');
    });
  });

  describe('shouldAutoDetectBinaryResponse', () => {
    it('detects text/json/xml as non-binary', () => {
      expect(shouldAutoDetectBinaryResponse('application/json')).toBe(false);
      expect(shouldAutoDetectBinaryResponse('text/plain')).toBe(false);
      expect(shouldAutoDetectBinaryResponse('text/html')).toBe(false);
      expect(shouldAutoDetectBinaryResponse('application/xml')).toBe(false);
    });

    it('detects binary content types', () => {
      expect(shouldAutoDetectBinaryResponse('image/png')).toBe(true);
      expect(shouldAutoDetectBinaryResponse('application/octet-stream')).toBe(true);
      expect(shouldAutoDetectBinaryResponse('')).toBe(true);
    });
  });

  describe('shouldUseBinaryResponseMode', () => {
    it('off never produces binary', () => {
      expect(shouldUseBinaryResponseMode('off', 'image/png')).toBe(false);
    });

    it('always produces binary', () => {
      expect(shouldUseBinaryResponseMode('always', 'application/json')).toBe(true);
    });

    it('auto uses content-type heuristics', () => {
      expect(shouldUseBinaryResponseMode('auto', 'image/png')).toBe(true);
      expect(shouldUseBinaryResponseMode('auto', 'application/json')).toBe(false);
    });
  });

  describe('parseContentDispositionFileName', () => {
    it('extracts quoted filename', () => {
      expect(
        parseContentDispositionFileName('attachment; filename="report.pdf"'),
      ).toBe('report.pdf');
    });

    it('extracts UTF-8 encoded filename', () => {
      expect(
        parseContentDispositionFileName("attachment; filename*=UTF-8''hello%20world.pdf"),
      ).toBe('hello world.pdf');
    });
  });

  describe('buildHttpResponseBinaryFromBuffer', () => {
    it('encodes buffer as binary attachment with mime type', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const result = buildHttpResponseBinaryFromBuffer(buffer, {
        mode: 'auto',
        binaryPropertyName: 'data',
        contentTypeHeader: 'image/png',
      });
      expect(result.responseBinary?.propertyName).toBe('data');
      expect(result.responseBinary?.attachment.mimeType).toBe('image/png');
      expect(result.responseBinary?.attachment.fileSize).toBe(4);
      expect(result.body).toBeUndefined();
    });

    it('sets body null when mode is always', () => {
      const buffer = Buffer.from('hello');
      const result = buildHttpResponseBinaryFromBuffer(buffer, {
        mode: 'always',
        binaryPropertyName: 'data',
        contentTypeHeader: 'text/plain',
      });
      expect(result.body).toBeNull();
      expect(result.responseBinary?.attachment.mimeType).toBe('text/plain');
    });

    it('includes fileName from content-disposition', () => {
      const buffer = Buffer.from('pdf-content');
      const result = buildHttpResponseBinaryFromBuffer(buffer, {
        mode: 'always',
        binaryPropertyName: 'file',
        contentTypeHeader: 'application/pdf',
        contentDisposition: 'attachment; filename="doc.pdf"',
      });
      expect(result.responseBinary?.propertyName).toBe('file');
      expect(result.responseBinary?.attachment.fileName).toBe('doc.pdf');
    });

    it('returns empty body for zero-length buffer', () => {
      const result = buildHttpResponseBinaryFromBuffer(Buffer.alloc(0), {
        mode: 'auto',
        binaryPropertyName: 'data',
        contentTypeHeader: 'image/png',
      });
      expect(result.body).toBeNull();
      expect(result.responseBinary).toBeUndefined();
    });
  });

  describe('produceHttpResponseBinaryFromResponse', () => {
    it('returns null body for 204 No Content', async () => {
      const response = new Response(null, { status: 204 });
      await expect(
        produceHttpResponseBinaryFromResponse(response, {}),
      ).resolves.toEqual({ body: null });
    });

    it('parses JSON when mode is off (default)', async () => {
      const response = new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      await expect(
        produceHttpResponseBinaryFromResponse(response, {}),
      ).resolves.toEqual({ body: { ok: true } });
    });

    it('produces binary for PNG when mode is auto', async () => {
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const response = new Response(pngBytes, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
      const parsed = await produceHttpResponseBinaryFromResponse(response, {
        responseBinaryMode: 'auto',
      });
      expect(parsed.responseBinary?.attachment.mimeType).toBe('image/png');
      expect(parsed.responseBinary?.propertyName).toBe('data');
      expect(parsed.body).toBeUndefined();
    });

    it('keeps JSON in body when auto mode sees json content-type', async () => {
      const response = new Response(JSON.stringify({ x: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
      const parsed = await produceHttpResponseBinaryFromResponse(response, {
        responseBinaryMode: 'auto',
      });
      expect(parsed.body).toEqual({ x: 1 });
      expect(parsed.responseBinary).toBeUndefined();
    });
  });

  describe('applyHttpResponseBinaryToItem', () => {
    it('merges response binary into item.binary', () => {
      const attachment = {
        data: 'aGVsbG8=',
        mimeType: 'text/plain',
        fileSize: 5,
      };
      const item = applyHttpResponseBinaryToItem(
        { json: { statusCode: 200 } },
        { propertyName: 'data', attachment },
      );
      expect(item.binary?.data).toEqual(attachment);
      expect(item.json).toEqual({ statusCode: 200 });
    });

    it('preserves existing item binary fields', () => {
      const existing = {
        data: 'aGVsbG8=',
        mimeType: 'text/plain',
        fileSize: 5,
      };
      const incoming = {
        data: 'd29ybGQ=',
        mimeType: 'image/png',
        fileSize: 5,
      };
      const item = applyHttpResponseBinaryToItem(
        { json: {}, binary: { existing } },
        { propertyName: 'response', attachment: incoming },
      );
      expect(item.binary?.existing).toEqual(existing);
      expect(item.binary?.response).toEqual(incoming);
    });
  });
});
