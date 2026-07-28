import { appendFile, mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { skillError } from '../errors.js';
import type { ToolInvokeClient } from '../loaders/skill-loader.js';

export interface DispatchWriteRequest {
  /** Whether toolWrite satellite is wired / write capability registered for skillRun */
  writeToolRegistered: boolean;
  scanRoots: string[];
  path: string;
  content: string;
  append?: boolean;
  timeoutMs?: number;
}

export interface WriteResult {
  path: string;
  bytesWritten: number;
}

function isInsideRoots(target: string, scanRoots: string[]): boolean {
  const normalized = target.replace(/\\/g, '/');
  return scanRoots.some((root) => {
    const r = root.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === r || normalized.startsWith(`${r}/`);
  });
}

async function resolveWritePath(path: string, scanRoots: string[]): Promise<string | null> {
  const abs = resolve(path);
  try {
    const rp = await realpath(abs);
    if (!isInsideRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    const parent = dirname(abs);
    try {
      const parentRp = await realpath(parent);
      if (!isInsideRoots(parentRp, scanRoots)) return null;
      if (!isInsideRoots(abs, scanRoots)) return null;
      return abs;
    } catch {
      if (!isInsideRoots(abs, scanRoots)) return null;
      return abs;
    }
  }
}

async function writeWithinScanRoots(
  request: DispatchWriteRequest,
): Promise<WriteResult> {
  const scanRoots = request.scanRoots;
  if (scanRoots.length === 0) {
    throw skillError('E1056', 'Path outside scanRoots');
  }

  const path = String(request.path ?? '').trim();
  if (!path) {
    throw skillError('E2002', 'path is required');
  }

  const content = String(request.content ?? '');
  const resolved = await resolveWritePath(path, scanRoots);
  if (!resolved) {
    throw skillError('E1056', 'Path outside scanRoots');
  }

  try {
    await mkdir(dirname(resolved), { recursive: true });
    if (request.append === true) {
      await appendFile(resolved, content, 'utf8');
    } else {
      await writeFile(resolved, content, 'utf8');
    }
    return {
      path: resolved,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
    };
  } catch (e) {
    throw skillError('E1041', e instanceof Error ? e.message : String(e));
  }
}

export async function dispatchWrite(
  request: DispatchWriteRequest,
  toolInvoke: ToolInvokeClient | undefined,
): Promise<WriteResult> {
  if (!request.writeToolRegistered) {
    throw skillError('E1041', 'Write tool is not registered');
  }

  if (toolInvoke) {
    const res = await toolInvoke.invoke({
      capability: 'skill:filesystem',
      method: 'write',
      args: {
        path: request.path,
        content: request.content,
        append: request.append === true,
      },
      scanRoots: request.scanRoots,
      timeoutMs: request.timeoutMs ?? 60_000,
    });
    if (res.status !== 'success') {
      throw skillError(res.errorCode ?? 'E1041', res.errorMessage ?? 'Write failed');
    }
    const result = res.result as { path?: string; bytesWritten?: number } | undefined;
    return {
      path: String(result?.path ?? request.path),
      bytesWritten: Number(result?.bytesWritten ?? Buffer.byteLength(request.content, 'utf8')),
    };
  }

  return writeWithinScanRoots(request);
}
