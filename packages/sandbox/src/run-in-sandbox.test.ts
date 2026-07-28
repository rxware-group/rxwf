import { describe, it, expect } from 'vitest';
import { AwfError } from '@rxwf/shared';
import { runInSandbox } from './run-in-sandbox.js';

describe('runInSandbox', () => {
  it('returns json from user code return value', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { sum: $input[0].json.a + $input[0].json.b } }];',
      inputItems: [{ json: { a: 2, b: 3 } }],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ sum: 5 });
    expect(result.logs).toEqual([]);
  });

  it('collects $log entries from user code', async () => {
    const result = await runInSandbox({
      code: '$log.info("hello"); return [{ json: { ok: true } }];',
      inputItems: [{ json: {} }],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ ok: true });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]!.level).toBe('info');
    expect(result.logs[0]!.message).toBe('hello');
  });

  it('collects $log.debug entries from user code', async () => {
    const result = await runInSandbox({
      code: '$log.debug("trace"); return [{ json: { ok: true } }];',
      inputItems: [{ json: {} }],
      timeoutMs: 5000,
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]!.level).toBe('debug');
    expect(result.logs[0]!.message).toBe('trace');
  });

  it('exposes $env and $nodes to user code', async () => {
    const result = await runInSandbox({
      code: `return [{
  json: {
    apiUrl: $env.API_URL,
    upstreamId: $nodes["HTTP"].json.id,
  },
}];`,
      inputItems: [{ json: { x: 1 } }],
      env: { API_URL: 'https://api.example.com' },
      nodes: [
        {
          name: 'HTTP',
          json: { id: '42' },
          items: [{ json: { id: '42' } }],
        },
      ],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({
      apiUrl: 'https://api.example.com',
      upstreamId: '42',
    });
  });

  it('does not time out when timeoutMs is omitted', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { ok: true } }];',
      inputItems: [{ json: {} }],
    });
    expect(result.items[0]?.json).toEqual({ ok: true });
  });

  it('exposes $vars and $env to user code', async () => {
    const result = await runInSandbox({
      code: `return [{
        json: {
          baseUrl: $vars.API_BASE,
          secret: $env.API_KEY,
        },
      }];`,
      inputItems: [{ json: {} }],
      env: { API_KEY: 'secret' },
      vars: { API_BASE: 'https://api.example.com' },
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({
      baseUrl: 'https://api.example.com',
      secret: 'secret',
    });
  });

  it('times out with E2002 when timeoutMs is positive and code loops', async () => {
    await expect(
      runInSandbox({
        code: 'while (true) {} return [{ json: {} }];',
        inputItems: [{ json: {} }],
        timeoutMs: 200,
      }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AwfError &&
        err.code === 'E2002' &&
        err.message === 'Sandbox execution timed out'
      );
    });
  });

  it('does not time out when timeoutMs is -1', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { ok: true } }];',
      inputItems: [{ json: {} }],
      timeoutMs: -1,
    });
    expect(result.items[0]?.json).toEqual({ ok: true });
  });

  it('returns binary from user code return value', async () => {
    const result = await runInSandbox({
      code: `return [{
        json: { ok: true },
        binary: {
          data: {
            data: Buffer.from('hello').toString('base64'),
            mimeType: 'text/plain',
            fileSize: 5,
          },
        },
      }];`,
      inputItems: [{ json: {} }],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ ok: true });
    expect(result.items[0]?.binary?.data?.mimeType).toBe('text/plain');
    const attachment = result.items[0]?.binary?.data;
    expect(attachment?.data).toBeTruthy();
    expect(Buffer.from(String(attachment?.data), 'base64').toString()).toBe('hello');
  });

  it('passes input binary to user code via $binary global', async () => {
    const result = await runInSandbox({
      code: `return [{
        json: { mime: $binary.data.mimeType, size: $binary.data.fileSize },
      }];`,
      inputItems: [
        {
          json: { name: 'file' },
          binary: {
            data: {
              data: Buffer.from('x').toString('base64'),
              mimeType: 'image/png',
              fileSize: 1,
            },
          },
        },
      ],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ mime: 'image/png', size: 1 });
  });

  it('exposes $json global for first input item', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { id: $json.id } }];',
      inputItems: [{ json: { id: 99 } }],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ id: 99 });
  });

  it('exposes node binary via $nodes bracket access', async () => {
    const result = await runInSandbox({
      code: `return [{ json: { mime: $nodes["HTTP"]?.binary?.data?.mimeType } }];`,
      inputItems: [{ json: {} }],
      nodes: [
        {
          name: 'HTTP',
          json: { ok: true },
          items: [
            {
              json: { ok: true },
              binary: {
                data: {
                  data: Buffer.from('x').toString('base64'),
                  mimeType: 'application/pdf',
                  fileSize: 1,
                },
              },
            },
          ],
        },
      ],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ mime: 'application/pdf' });
  });

  it('exposes $input.all() like expression context', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { count: $input.all().length, first: $input.first()?.json.id } }];',
      inputItems: [{ json: { id: 1 } }, { json: { id: 2 } }],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ count: 2, first: 1 });
  });

  it('exposes $execution and $workflow metadata', async () => {
    const result = await runInSandbox({
      code: `return [{
        json: {
          execId: $execution.id,
          env: $execution.environment,
          wfName: $workflow.name,
        },
      }];`,
      inputItems: [{ json: {} }],
      execution: { id: 'exec-9', mode: 'manual', environment: 'test' },
      workflow: { id: 'wf-9', name: 'My Flow' },
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({
      execId: 'exec-9',
      env: 'test',
      wfName: 'My Flow',
    });
  });

  it('passes input binary to user code via $input', async () => {
    const result = await runInSandbox({
      code: `return [{
        json: { mime: $input[0].binary.data.mimeType },
      }];`,
      inputItems: [
        {
          json: {},
          binary: {
            data: {
              data: Buffer.from('x').toString('base64'),
              mimeType: 'image/png',
              fileSize: 1,
            },
          },
        },
      ],
      timeoutMs: 5000,
    });
    expect(result.items[0]?.json).toEqual({ mime: 'image/png' });
  });

  it('returns multiple items when user code maps $input.all()', async () => {
    const result = await runInSandbox({
      code: 'return $input.all().map((item) => ({ json: { id: item.json.id, doubled: item.json.id * 2 } }));',
      inputItems: [{ json: { id: 1 } }, { json: { id: 2 } }],
      timeoutMs: 5000,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.json).toEqual({ id: 1, doubled: 2 });
    expect(result.items[1]?.json).toEqual({ id: 2, doubled: 4 });
  });
});
