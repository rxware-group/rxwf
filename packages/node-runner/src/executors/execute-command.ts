import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { NodeExecutor } from '../types/node-executor.js';
import { resolveExecuteCommandArgv } from './execute-command-args.js';

const execAsync = promisify(exec);

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

function resolveCommandTimeoutMs(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_COMMAND_TIMEOUT_MS;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_COMMAND_TIMEOUT_MS;
  if (n === 0) return undefined;
  if (n < 0) return DEFAULT_COMMAND_TIMEOUT_MS;
  return Math.floor(n);
}

interface CommandRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

function runWithSpawn(
  command: string,
  argv: string[],
  options: { cwd?: string; env: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<CommandRunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, argv, {
      cwd: options.cwd,
      env: options.env,
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    const timer =
      options.timeoutMs != null
        ? setTimeout(() => {
            timedOut = true;
            child.kill();
          }, options.timeoutMs)
        : undefined;

    const finish = (result: CommandRunResult) => {
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.on('error', (err) => {
      finish({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 1,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      finish({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: timedOut ? 1 : (code ?? 1),
        ...(timedOut ? { error: 'Command timed out' } : {}),
      });
    });
  });
}

async function runCommand(
  config: Record<string, unknown>,
  itemJson: Record<string, unknown>,
): Promise<CommandRunResult> {
  const { command, argv, legacyShellLine } = resolveExecuteCommandArgv(config);
  const timeoutMs = resolveCommandTimeoutMs(config.timeoutMs);
  const cwd = config.cwd ? String(config.cwd) : undefined;
  const env = {
    ...process.env,
    RXWF_JSON: JSON.stringify(itemJson),
  };

  if (legacyShellLine) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        ...(timeoutMs != null ? { timeout: timeoutMs } : {}),
        cwd,
        env,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 0,
      };
    } catch (e) {
      const err = e as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return {
        stdout: err.stdout?.trimEnd() ?? '',
        stderr: err.stderr?.trimEnd() ?? '',
        exitCode: typeof err.code === 'number' ? err.code : 1,
        error: err.message ?? String(e),
      };
    }
  }

  return runWithSpawn(command, argv, { cwd, env, timeoutMs });
}

export const executeCommandExecutor: NodeExecutor = {
  type: 'executeCommand',
  async execute(ctx) {
    const { command, argv, legacyShellLine } = resolveExecuteCommandArgv(ctx.config);
    if (!command) {
      return {
        status: 'failed',
        errorCode: 'E2002',
        errorMessage: '命令不能为空',
        outputItems: [[]],
      };
    }
    if (!legacyShellLine && argv.length === 0) {
      return {
        status: 'failed',
        errorCode: 'E2002',
        errorMessage: '请至少填写一个非空参数，或使用整段命令（旧版单字段 command）',
        outputItems: [[]],
      };
    }

    const items = ctx.inputItems.length > 0 ? ctx.inputItems : [{ json: {} }];
    const outputItems: { json: Record<string, unknown> }[] = [];

    for (const item of items) {
      const result = await runCommand(ctx.config, item.json);
      outputItems.push({
        json: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          ...(result.error ? { error: result.error } : {}),
          ...(legacyShellLine ? { legacyShellLine: true } : {}),
        },
      });
    }

    const failed = outputItems.some(
      (o) => typeof o.json.exitCode === 'number' && o.json.exitCode !== 0,
    );

    return {
      status: failed ? 'failed' : 'success',
      outputItems: [outputItems],
      ...(failed
        ? { errorCode: 'E2002', errorMessage: '部分命令执行失败' }
        : {}),
    };
  },
};
