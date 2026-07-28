import { describe, it, expect } from 'vitest';
import { createExecutorRegistry } from '../registry/executor-registry.js';
import { registerBuiltinExecutors } from './register-builtin.js';
import { executeCommandExecutor } from './execute-command.js';

function argvEchoConfig(message: string) {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'echo', message] };
  }
  return { command: 'echo', args: [message] };
}

describe('executeCommand registry', () => {
  it('throws E2003 when executeCommand executor is not registered', async () => {
    const registry = createExecutorRegistry();
    await expect(
      registry.execute('executeCommand', { config: {}, inputItems: [] }),
    ).rejects.toMatchObject({ code: 'E2003' });
  });

  it('is registered and executable via registerBuiltinExecutors', async () => {
    const registry = createExecutorRegistry();
    registerBuiltinExecutors(registry);
    expect(registry.has('executeCommand')).toBe(true);

    const result = await registry.execute('executeCommand', {
      config: argvEchoConfig('registry-ok'),
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.stdout).toContain('registry-ok');
  });
});

describe('executeCommandExecutor', () => {
  it('runs command + args and returns stdout per input item', async () => {
    const result = await executeCommandExecutor.execute({
      config: {
        command: process.platform === 'win32' ? 'cmd' : 'echo',
        args: process.platform === 'win32' ? ['/c', 'echo', 'hello-rxwf'] : ['hello-rxwf'],
      },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.stdout).toContain('hello-rxwf');
    expect(result.outputItems?.[0]?.[0]?.json.exitCode).toBe(0);
  });

  it('preserves quotes in argv without shell escaping', async () => {
    if (process.platform === 'win32') return;
    const result = await executeCommandExecutor.execute({
      config: {
        command: 'printf',
        args: ['%s\\n', 'say "hello"'],
      },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.stdout).toBe('say "hello"');
  });

  it('supports legacy shell line in command field', async () => {
    const cmd =
      process.platform === 'win32' ? 'echo hello-legacy' : 'echo hello-legacy';
    const result = await executeCommandExecutor.execute({
      config: { command: cmd },
      inputItems: [{ json: { id: 1 } }],
    });
    expect(result.status).toBe('success');
    expect(result.outputItems?.[0]?.[0]?.json.stdout).toContain('hello-legacy');
    expect(result.outputItems?.[0]?.[0]?.json.legacyShellLine).toBe(true);
  });

  it('fails when command is empty', async () => {
    const result = await executeCommandExecutor.execute({
      config: { command: '   ' },
      inputItems: [],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.errorMessage).toContain('命令');
  });

  it('fails fast when argv mode has no non-empty args', async () => {
    const result = await executeCommandExecutor.execute({
      config: { command: 'npx', args: [''] },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.errorMessage).toContain('参数');
  });

  it('returns E2002 when command exits non-zero', async () => {
    const result = await executeCommandExecutor.execute({
      config:
        process.platform === 'win32'
          ? { command: 'cmd', args: ['/c', 'exit', '7'] }
          : { command: 'sh', args: ['-c', 'exit 7'] },
      inputItems: [{ json: {} }],
    });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('E2002');
    expect(result.outputItems?.[0]?.[0]?.json.exitCode).toBe(7);
  });
});
