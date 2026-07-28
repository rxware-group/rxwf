import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { RxwfHookDef, RxwfHookEvent } from './hook-catalog.js';
import { indexRxwfHooks, validateHookDef } from './hook-catalog.js';

export interface RunHooksInput {
  workspaceRoot: string;
  event: RxwfHookEvent;
  nodeType?: string;
  enabled?: boolean;
}

export async function runRxwfHooks(input: RunHooksInput): Promise<
  Array<{ hookId: string; status: 'success' | 'failed' | 'skipped'; output?: string }>
> {
  if (input.enabled === false) return [];
  const hooks = await indexRxwfHooks(input.workspaceRoot);
  const results: Array<{
    hookId: string;
    status: 'success' | 'failed' | 'skipped';
    output?: string;
  }> = [];

  for (const hook of hooks) {
    if (hook.event !== input.event) continue;
    if (
      hook.nodeTypes?.length &&
      input.nodeType &&
      !hook.nodeTypes.includes(input.nodeType)
    ) {
      results.push({ hookId: hook.id, status: 'skipped' });
      continue;
    }
    try {
      validateHookDef(hook);
      const output = await execHookCommand(
        hook.command,
        input.workspaceRoot,
        hook.timeoutMs,
      );
      results.push({ hookId: hook.id, status: 'success', output });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ hookId: hook.id, status: 'failed', output: msg });
    }
  }
  return results;
}

function execHookCommand(
  command: string,
  workspaceRoot: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'cmd.exe' : 'sh', isWin ? ['/c', command] : ['-c', command], {
      cwd: workspaceRoot,
      timeout: timeoutMs,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim() || 'ok');
      else reject(new Error(stderr.trim() || `hook exited ${code}`));
    });
  });
}

/** Resolve hook script path under `.rxwf/scripts/` when command is relative. */
export function resolveHookCommandPath(command: string, workspaceRoot: string): string {
  if (command.includes('/') || command.includes('\\') || command.startsWith('.')) {
    return join(workspaceRoot, command);
  }
  return join(workspaceRoot, '.rxwf', 'scripts', command);
}
