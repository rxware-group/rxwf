import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { ToolInvokeClient } from '../loaders/skill-loader.js';
import { dispatchWrite } from './write.js';

describe('dispatchWrite', () => {
  it('throws E104x when write tool is not registered', async () => {
    await expect(
      dispatchWrite(
        {
          writeToolRegistered: false,
          scanRoots: ['/tmp'],
          path: '/tmp/out.txt',
          content: 'hello',
        },
        undefined,
      ),
    ).rejects.toMatchObject({ code: /^E104\d$/ });
  });

  it('writes file and content can be read back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-write-'));
    try {
      const target = join(dir, 'note.txt');
      const result = await dispatchWrite(
        {
          writeToolRegistered: true,
          scanRoots: [dir],
          path: target,
          content: 'hello write',
        },
        undefined,
      );
      expect(result.bytesWritten).toBeGreaterThan(0);
      await expect(readFile(target, 'utf8')).resolves.toBe('hello write');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('appends when append is true', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rxwf-write-append-'));
    try {
      const target = join(dir, 'append.txt');
      await dispatchWrite(
        {
          writeToolRegistered: true,
          scanRoots: [dir],
          path: target,
          content: 'line1\n',
        },
        undefined,
      );
      await dispatchWrite(
        {
          writeToolRegistered: true,
          scanRoots: [dir],
          path: target,
          content: 'line2\n',
          append: true,
        },
        undefined,
      );
      await expect(readFile(target, 'utf8')).resolves.toBe('line1\nline2\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('delegates to toolInvoke client when provided', async () => {
    const client: ToolInvokeClient = {
      invoke: async (request) => ({
        status: 'success',
        result: { path: request.args.path, bytesWritten: 5 },
      }),
    };
    const result = await dispatchWrite(
      {
        writeToolRegistered: true,
        scanRoots: ['/workspace'],
        path: '/workspace/a.txt',
        content: 'hello',
      },
      client,
    );
    expect(result).toEqual({ path: '/workspace/a.txt', bytesWritten: 5 });
  });

  it('propagates toolInvoke failure', async () => {
    const client: ToolInvokeClient = {
      invoke: async () => ({
        status: 'failed',
        errorCode: 'E1056',
        errorMessage: 'Path outside scanRoots',
      }),
    };
    await expect(
      dispatchWrite(
        {
          writeToolRegistered: true,
          scanRoots: ['/workspace'],
          path: '/etc/passwd',
          content: 'nope',
        },
        client,
      ),
    ).rejects.toMatchObject({ code: 'E1056' });
  });
});
