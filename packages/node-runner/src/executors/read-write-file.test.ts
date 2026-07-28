import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeBinaryBuffer } from '@rxwf/shared';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerPlusExecutors } from './register-plus.js';
import { readWriteFileExecutor } from './read-write-file.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readWriteFileAuditRowPath = join(
  repoRoot,
  'docs/test/node-audit-rows/readWriteFile.md',
);

describe('readWriteFile registry', () => {
  it('throws E2003 when readWriteFile executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('readWriteFile', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered via registerPlusExecutors', () => {
    const registry = createExecutorRegistry();
    registerPlusExecutors(registry);
    expect(registry.has('readWriteFile')).toBe(true);
  });
});

describe('readWriteFile M-3 audit row', () => {
  it('documents panel, validation, executor, and error_codes with ok status', () => {
    expect(existsSync(readWriteFileAuditRowPath)).toBe(true);
    const content = readFileSync(readWriteFileAuditRowPath, 'utf8');
    expect(content).toContain('AUDIT-N-readWriteFile');
    expect(content).toContain('| status | ok |');
    expect(content).toContain('| panel | ok |');
    expect(content).toContain('| validation | ok |');
    expect(content).toContain('| executor | ok |');
    expect(content).toContain('E2E-N-readWriteFile');
  });
});

describe('readWriteFileExecutor', () => {
  it('writes then reads file content', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-'));
    const path = join(dir, 'nested', 'hello.txt');

    const writeResult = await readWriteFileExecutor.execute({
      config: { operation: 'write', path, content: 'hello world' },
      inputItems: [{ json: {} }],
    });
    expect(writeResult.status).toBe('success');
    expect(writeResult.outputItems?.[0]?.[0]?.json.bytesWritten).toBe(11);

    const readResult = await readWriteFileExecutor.execute({
      config: { operation: 'read', path },
      inputItems: [{ json: {} }],
    });
    expect(readResult.status).toBe('success');
    expect(readResult.outputItems?.[0]?.[0]?.json.content).toBe('hello world');
    expect(await readFile(path, 'utf8')).toBe('hello world');
  });

  it('writes content from input item json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-'));
    const path = join(dir, 'from-input.txt');

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'write', path },
      inputItems: [{ json: { content: 'from item' } }],
    });

    expect(result.status).toBe('success');
    expect(await readFile(path, 'utf8')).toBe('from item');
  });

  it('appends content to an existing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-'));
    const path = join(dir, 'append.txt');

    const writeResult = await readWriteFileExecutor.execute({
      config: { operation: 'write', path, content: 'line1\n' },
      inputItems: [{ json: {} }],
    });
    expect(writeResult.status).toBe('success');

    const appendResult = await readWriteFileExecutor.execute({
      config: { operation: 'append', path, content: 'line2\n' },
      inputItems: [{ json: {} }],
    });
    expect(appendResult.status).toBe('success');
    expect(appendResult.outputItems?.[0]?.[0]?.json.operation).toBe('append');
    expect(await readFile(path, 'utf8')).toBe('line1\nline2\n');
  });

  it('fails when path is empty', async () => {
    const result = await readWriteFileExecutor.execute({
      config: { operation: 'read', path: '  ' },
      inputItems: [],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.errorMessage).toContain('路径不能为空');
  });

  it('fails with E2002 for unsupported operation', async () => {
    const result = await readWriteFileExecutor.execute({
      config: { operation: 'delete', path: '/tmp/x' },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.errorMessage).toContain('不支持的操作');
  });

  it('readBinary loads file bytes into item.binary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-bin-'));
    const path = join(dir, 'sample.bin');
    await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'readBinary', path },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    const item = result.outputItems?.[0]?.[0];
    expect(item?.json.operation).toBe('readBinary');
    expect(item?.json.fileSize).toBe(4);
    expect(item?.binary?.data?.mimeType).toBe('application/octet-stream');
    const attachment = item?.binary?.data;
    expect(attachment?.data).toBeTruthy();
    expect(Buffer.from(String(attachment?.data), 'base64')).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it('readBinary uses png mime type from file extension', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-png-'));
    const path = join(dir, 'image.png');
    await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'readBinary', path, binaryPropertyName: 'file' },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.binary?.file?.mimeType).toBe('image/png');
    expect(result.outputItems?.[0]?.[0]?.binary?.file?.fileName).toBe('image.png');
  });

  it('writeBinary decodes item.binary and writes bytes to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-write-bin-'));
    const path = join(dir, 'nested', 'out.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'writeBinary', path },
      inputItems: [
        {
          json: { statusCode: 200 },
          binary: {
            data: {
              data: bytes.toString('base64'),
              mimeType: 'image/png',
              fileSize: bytes.length,
            },
          },
        },
      ],
    });

    expect(result.status).toBe('success');
    const item = result.outputItems?.[0]?.[0];
    expect(item?.json.operation).toBe('writeBinary');
    expect(item?.json.bytesWritten).toBe(bytes.length);
    expect(item?.binary?.data?.mimeType).toBe('image/png');
    expect(await readFile(path)).toEqual(bytes);
  });

  it('writeBinary round-trips with readBinary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-roundtrip-'));
    const path = join(dir, 'roundtrip.bin');
    const bytes = Buffer.from('hello-binary');

    await readWriteFileExecutor.execute({
      config: { operation: 'writeBinary', path },
      inputItems: [
        {
          json: {},
          binary: {
            data: encodeBinaryBuffer(bytes, 'application/octet-stream'),
          },
        },
      ],
    });

    const readResult = await readWriteFileExecutor.execute({
      config: { operation: 'readBinary', path },
      inputItems: [{ json: {} }],
    });

    expect(readResult.status).toBe('success');
    const attachment = readResult.outputItems?.[0]?.[0]?.binary?.data;
    expect(Buffer.from(String(attachment?.data), 'base64').toString()).toBe('hello-binary');
  });

  it('writeBinary fails when binary property is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-missing-'));
    const path = join(dir, 'out.bin');

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'writeBinary', path, binaryPropertyName: 'file' },
      inputItems: [{ json: {} }],
    });

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('binary.file');
  });

  it('write without content saves upstream binary (HTTP-like item)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-http-write-'));
    const path = join(dir, 'photo.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'write', path },
      inputItems: [
        {
          json: { ok: true, statusCode: 200, headers: { 'content-type': 'image/png' } },
          binary: {
            data: {
              data: bytes.toString('base64'),
              mimeType: 'image/png',
              fileSize: bytes.length,
            },
          },
        },
      ],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.operation).toBe('write');
    expect(result.outputItems?.[0]?.[0]?.json.bytesWritten).toBe(bytes.length);
    expect(await readFile(path)).toEqual(bytes);
  });

  it('resolves content {{ $json.body }} in expression mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-content-'));
    const path = join(dir, 'out.txt');

    const result = await readWriteFileExecutor.execute({
      config: {
        operation: 'write',
        path,
        content: '{{ $json.body }}',
        _fieldModes: { content: 'expression' },
      },
      inputItems: [{ json: { body: 'hello from http' } }],
    });

    expect(result.status).toBe('success');
    expect(await readFile(path, 'utf8')).toBe('hello from http');
  });

  it('resolves path with embedded {{ $itemIndex }} in expression mode', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-expr-'));

    const result = await readWriteFileExecutor.execute({
      config: {
        operation: 'write',
        path: join(dir, '{{ $itemIndex }}.html'),
        content: 'ok',
        _fieldModes: { path: 'expression' },
      },
      inputItems: [{ json: {} }, { json: {} }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.map((item) => item.json.path)).toEqual([
      join(dir, '0.html'),
      join(dir, '1.html'),
    ]);
    expect(await readFile(join(dir, '0.html'), 'utf8')).toBe('ok');
    expect(await readFile(join(dir, '1.html'), 'utf8')).toBe('ok');
  });

  it('resolves embedded {{ $itemIndex }} in fixed mode path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-fixed-embed-'));

    const result = await readWriteFileExecutor.execute({
      config: {
        operation: 'write',
        path: join(dir, 'item-{{ $itemIndex }}.txt'),
        content: 'x',
        _fieldModes: { path: 'fixed' },
      },
      inputItems: [{ json: {} }, { json: {} }],
    });

    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.map((item) => item.json.path)).toEqual([
      join(dir, 'item-0.txt'),
      join(dir, 'item-1.txt'),
    ]);
    expect(await readFile(join(dir, 'item-0.txt'), 'utf8')).toBe('x');
    expect(await readFile(join(dir, 'item-1.txt'), 'utf8')).toBe('x');
  });

  it('write with explicit content ignores upstream binary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-rw-text-priority-'));
    const path = join(dir, 'out.txt');

    const result = await readWriteFileExecutor.execute({
      config: { operation: 'write', path, content: 'plain text' },
      inputItems: [
        {
          json: {},
          binary: {
            data: encodeBinaryBuffer(Buffer.from('binary'), 'application/octet-stream'),
          },
        },
      ],
    });

    expect(result.status).toBe('success');
    expect(await readFile(path, 'utf8')).toBe('plain text');
  });
});
