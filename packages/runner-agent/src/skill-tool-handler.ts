import { exec } from 'node:child_process';
import { readdir, readFile, realpath, stat, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  formatPathOutsideScanRootsMessage,
  type RunnerToolInvokeRequest,
  type RunnerToolInvokeResult,
} from '@rxwf/runner-protocol';
import { handleWebSearchInvoke } from './web-search-tool-handler.js';

let webSearchCredentialFilePath: string | undefined;

export function setWebSearchCredentialFilePath(path: string | undefined): void {
  webSearchCredentialFilePath = path;
}

const execAsync = promisify(exec);

const DEFAULT_SHELL_TIMEOUT_MS = 60_000;
const MAX_SHELL_TIMEOUT_MS = 300_000;
const DEFAULT_GREP_MAX_RESULTS = 50;
const MAX_GREP_MAX_RESULTS = 200;

const SHELL_COMMAND_BLACKLIST = [
  'rm -rf /',
  'rm -rf /*',
  'format c:',
  'format d:',
  'diskpart',
  'mkfs.',
  ':(){ :|:& };:',
];

export interface GrepMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

function isInsideRoots(target: string, scanRoots: string[]): boolean {
  const normalized = target.replace(/\\/g, '/');
  return scanRoots.some((root) => {
    const r = root.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === r || normalized.startsWith(`${r}/`);
  });
}

async function resolveWithinRoots(
  path: string,
  scanRoots: string[],
): Promise<string | null> {
  try {
    const abs = resolve(path);
    const rp = await realpath(abs);
    if (!isInsideRoots(rp, scanRoots)) return null;
    return rp;
  } catch {
    return null;
  }
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
      return null;
    }
  }
}

function matchesGlob(fileName: string, glob?: string): boolean {
  if (!glob) return true;
  const g = glob.replace(/\\/g, '/');
  if (g.startsWith('**/')) {
    const suffix = g.slice(3);
    if (suffix.startsWith('*.')) {
      return fileName.endsWith(suffix.slice(1));
    }
    return fileName.includes(suffix);
  }
  if (g.startsWith('*.')) {
    return fileName.endsWith(g.slice(1));
  }
  return fileName === g || fileName.endsWith(`/${g}`);
}

function isShellCommandBlocked(command: string): boolean {
  const normalized = command.toLowerCase().replace(/\s+/g, ' ').trim();
  return SHELL_COMMAND_BLACKLIST.some((blocked) => normalized.includes(blocked));
}

function resolveShellTimeoutMs(args: Record<string, unknown>, requestTimeoutMs: number): number {
  const raw = args.timeoutMs;
  if (raw !== undefined && raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return Math.min(Math.floor(n), MAX_SHELL_TIMEOUT_MS);
    }
  }
  if (requestTimeoutMs > 0) {
    return Math.min(requestTimeoutMs, MAX_SHELL_TIMEOUT_MS);
  }
  return DEFAULT_SHELL_TIMEOUT_MS;
}

async function grepFiles(
  pattern: string,
  startPath: string,
  scanRoots: string[],
  glob?: string,
  maxResults = DEFAULT_GREP_MAX_RESULTS,
): Promise<{ matches: GrepMatch[]; grepFallback: boolean }> {
  const resolvedStart = await resolveWithinRoots(startPath, scanRoots);
  if (!resolvedStart) {
    return { matches: [], grepFallback: true };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }

  const matches: GrepMatch[] = [];
  const limit = Math.min(Math.max(1, maxResults), MAX_GREP_MAX_RESULTS);

  async function searchFile(filePath: string): Promise<void> {
    if (matches.length >= limit) return;
    let content: string;
    try {
      const info = await stat(filePath);
      if (!info.isFile() || info.size > 512 * 1024) return;
      content = await readFile(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < limit; i++) {
      const line = lines[i] ?? '';
      const match = regex.exec(line);
      if (match) {
        matches.push({
          path: filePath,
          line: i + 1,
          column: (match.index ?? 0) + 1,
          text: line,
        });
      }
      regex.lastIndex = 0;
    }
  }

  async function walk(dirPath: string): Promise<void> {
    if (matches.length >= limit) return;
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (matches.length >= limit) return;
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(fullPath);
      } else if (entry.isFile() && matchesGlob(entry.name, glob)) {
        await searchFile(fullPath);
      }
    }
  }

  let info;
  try {
    info = await stat(resolvedStart);
  } catch {
    return { matches: [], grepFallback: true };
  }

  if (info.isFile()) {
    if (matchesGlob(resolvedStart.split(/[/\\]/).pop() ?? '', glob)) {
      await searchFile(resolvedStart);
    }
  } else if (info.isDirectory()) {
    await walk(resolvedStart);
  }

  return { matches, grepFallback: true };
}

export async function handleSkillToolInvoke(
  request: RunnerToolInvokeRequest,
): Promise<RunnerToolInvokeResult> {
  const started = Date.now();
  const fail = (errorCode: string, errorMessage: string): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'failed',
    errorCode,
    errorMessage,
    durationMs: Date.now() - started,
  });

  const success = (result: unknown): RunnerToolInvokeResult => ({
    invokeId: request.invokeId,
    status: 'success',
    result,
    durationMs: Date.now() - started,
  });

  const scanRoots = request.scanRoots ?? [];
  const outsideRoots = (opts?: { path?: string; cwd?: string }) =>
    fail('E1056', formatPathOutsideScanRootsMessage(scanRoots, opts));

  if (request.capability === 'skill:filesystem') {
    if (scanRoots.length === 0) {
      return outsideRoots();
    }

    const method = request.method;
    const args = request.args;

    if (method === 'read') {
      const path = String(args.path ?? '');
      const resolved = await resolveWithinRoots(path, scanRoots);
      if (!resolved) return outsideRoots({ path });
      try {
        const content = await readFile(resolved, 'utf8');
        return success(content);
      } catch (e) {
        return fail('E1041', e instanceof Error ? e.message : String(e));
      }
    }

    if (method === 'write') {
      const path = String(args.path ?? '');
      const content = String(args.content ?? '');
      const append = args.append === true;
      const resolved = await resolveWritePath(path, scanRoots);
      if (!resolved) return outsideRoots({ path });
      try {
        if (append) {
          await appendFile(resolved, content, 'utf8');
        } else {
          await writeFile(resolved, content, 'utf8');
        }
        return success({ path: resolved, bytesWritten: Buffer.byteLength(content, 'utf8') });
      } catch (e) {
        return fail('E1041', e instanceof Error ? e.message : String(e));
      }
    }

    if (method === 'grep') {
      const pattern = String(args.pattern ?? '');
      if (!pattern) return fail('E2002', 'grep pattern is required');
      const startPath = args.path ? String(args.path) : scanRoots[0] ?? '.';
      const glob = args.glob ? String(args.glob) : undefined;
      const maxResultsRaw = Number(args.maxResults ?? DEFAULT_GREP_MAX_RESULTS);
      const maxResults = Number.isFinite(maxResultsRaw)
        ? Math.min(Math.max(1, Math.floor(maxResultsRaw)), MAX_GREP_MAX_RESULTS)
        : DEFAULT_GREP_MAX_RESULTS;

      if (args.path) {
        const resolved = await resolveWithinRoots(startPath, scanRoots);
        if (!resolved) return outsideRoots({ path: startPath });
      }

      try {
        const { matches, grepFallback } = await grepFiles(
          pattern,
          startPath,
          scanRoots,
          glob,
          maxResults,
        );
        return success({ matches, ...(grepFallback ? { grepFallback: true } : {}) });
      } catch (e) {
        return fail('E1041', e instanceof Error ? e.message : String(e));
      }
    }

    if (method === 'resolveWorkspace') {
      let dir = String(args.startDir ?? scanRoots[0] ?? '.');
      for (let i = 0; i < 32; i++) {
        const candidate = resolve(dir, '.rxwf', 'skills');
        const resolved = await resolveWithinRoots(candidate, scanRoots);
        if (resolved) {
          return success(dirname(dirname(resolved)));
        }
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return fail('E1060', 'workspace root not found');
    }

    return fail('E2002', `Unknown filesystem method: ${method}`);
  }

  if (request.capability === 'web_search') {
    return handleWebSearchInvoke(request, {
      credentialFilePath: webSearchCredentialFilePath,
    });
  }

  if (request.capability === 'admin:filesystem') {
    if (request.method !== 'list') {
      return fail('E2002', `Unknown admin filesystem method: ${request.method}`);
    }
    const args = request.args;
    const dirsOnly = args.dirsOnly !== false;
    const rawPath = String(args.path ?? '').trim();
    try {
      if (process.platform === 'win32' && rawPath === '') {
        const drives: Array<{ name: string; path: string; kind: 'directory' | 'file' }> = [];
        for (let i = 65; i <= 90; i++) {
          const letter = String.fromCharCode(i);
          const root = `${letter}:\\`;
          drives.push({ name: root, path: root, kind: 'directory' });
        }
        return success({ path: '', parent: null, entries: drives });
      }
      const target = resolve(rawPath || '/');
      let abs: string;
      try {
        abs = await realpath(target);
      } catch {
        abs = target;
      }
      const info = await stat(abs);
      if (!info.isDirectory()) {
        return fail('E1041', `Not a directory: ${abs}`);
      }
      const dirents = await readdir(abs, { withFileTypes: true });
      const entries: Array<{ name: string; path: string; kind: 'directory' | 'file' }> = [];
      for (const d of dirents) {
        const full = join(abs, d.name);
        if (d.isDirectory()) {
          entries.push({ name: d.name, path: full, kind: 'directory' });
        } else if (!dirsOnly && d.isFile()) {
          entries.push({ name: d.name, path: full, kind: 'file' });
        }
      }
      entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      const parentDir = dirname(abs);
      const parent =
        parentDir === abs || (process.platform === 'win32' && /^[A-Za-z]:\\?$/.test(abs))
          ? process.platform === 'win32'
            ? ''
            : null
          : parentDir;
      return success({ path: abs, parent, entries });
    } catch (e) {
      return fail('E1041', e instanceof Error ? e.message : String(e));
    }
  }

  if (request.capability === 'shell' && request.method === 'exec') {
    if (scanRoots.length === 0) {
      return outsideRoots();
    }

    const args = request.args;
    const command = String(args.command ?? '').trim();
    if (!command) {
      return fail('E2002', 'command is required');
    }
    if (isShellCommandBlocked(command)) {
      return fail('E1058', 'Shell command blocked by blacklist');
    }

    const cwdArg = args.cwd ? String(args.cwd) : scanRoots[0] ?? '.';
    const resolvedCwd = await resolveWithinRoots(cwdArg, scanRoots);
    if (!resolvedCwd) {
      return outsideRoots({ cwd: cwdArg });
    }

    const cwdStat = await stat(resolvedCwd).catch(() => null);
    const cwd = cwdStat?.isDirectory() ? resolvedCwd : dirname(resolvedCwd);
    if (!isInsideRoots(cwd, scanRoots)) {
      return outsideRoots({ cwd: cwdArg });
    }

    const timeoutMs = resolveShellTimeoutMs(args, request.timeoutMs);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        env: process.env,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        maxBuffer: 10 * 1024 * 1024,
      });
      return success({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 0,
      });
    } catch (e) {
      const err = e as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        signal?: string;
      };
      if (err.killed || err.signal === 'SIGTERM') {
        return fail('E1058', 'Shell command timed out');
      }
      return success({
        stdout: err.stdout?.trimEnd() ?? '',
        stderr: err.stderr?.trimEnd() ?? '',
        exitCode: typeof err.code === 'number' ? err.code : 1,
        error: err.message ?? String(e),
      });
    }
  }

  return fail('E2002', `Unknown capability: ${request.capability}`);
}
