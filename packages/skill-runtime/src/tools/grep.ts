import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { skillError } from '../errors.js';
import type { ToolInvokeClient } from '../loaders/skill-loader.js';

export interface GrepMatch {
  path: string;
  line: number;
  column: number;
  text: string;
}

export interface GrepRequest {
  pattern: string;
  path?: string;
  glob?: string;
  patternType?: 'regex' | 'literal';
  caseInsensitive?: boolean;
  maxResults?: number;
}

export interface GrepResult {
  matches: GrepMatch[];
  grepFallback?: boolean;
}

export interface GrepInvokeOptions {
  scanRoots: string[];
  toolInvoke?: ToolInvokeClient;
  timeoutMs?: number;
}

const DEFAULT_GREP_MAX_RESULTS = 50;
const MAX_GREP_MAX_RESULTS = 200;

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

export function compileGrepRegex(
  pattern: string,
  opts?: { patternType?: 'regex' | 'literal'; caseInsensitive?: boolean },
): RegExp {
  const patternType = opts?.patternType ?? 'regex';
  const flags = opts?.caseInsensitive ? 'i' : '';

  if (patternType === 'literal') {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, flags);
  }

  try {
    return new RegExp(pattern, flags);
  } catch {
    throw skillError('E2002', `Invalid grep regex: ${pattern}`);
  }
}

function resolveMaxResults(maxResults?: number): number {
  if (maxResults === undefined) return DEFAULT_GREP_MAX_RESULTS;
  const n = Number(maxResults);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GREP_MAX_RESULTS;
  return Math.min(Math.floor(n), MAX_GREP_MAX_RESULTS);
}

async function grepLocal(
  request: GrepRequest,
  scanRoots: string[],
): Promise<GrepResult> {
  const pattern = String(request.pattern ?? '').trim();
  if (!pattern) {
    throw skillError('E2002', 'grep pattern is required');
  }

  const startPath = request.path ? String(request.path) : scanRoots[0] ?? '.';
  const glob = request.glob ? String(request.glob) : undefined;
  const maxResults = resolveMaxResults(request.maxResults);
  const regex = compileGrepRegex(pattern, {
    patternType: request.patternType,
    caseInsensitive: request.caseInsensitive,
  });

  if (request.path) {
    const resolved = await resolveWithinRoots(startPath, scanRoots);
    if (!resolved) {
      throw skillError(
        'E1056',
        `Path outside scan roots: ${startPath}`,
      );
    }
  }

  const resolvedStart = await resolveWithinRoots(startPath, scanRoots);
  if (!resolvedStart) {
    return { matches: [], grepFallback: true };
  }

  const matches: GrepMatch[] = [];

  async function searchFile(filePath: string): Promise<void> {
    if (matches.length >= maxResults) return;
    let content: string;
    try {
      const info = await stat(filePath);
      if (!info.isFile() || info.size > 512 * 1024) return;
      content = await readFile(filePath, 'utf8');
    } catch {
      return;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
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
    if (matches.length >= maxResults) return;
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (matches.length >= maxResults) return;
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

export async function invokeGrep(
  request: GrepRequest,
  opts: GrepInvokeOptions,
): Promise<GrepResult> {
  const pattern = String(request.pattern ?? '').trim();
  if (!pattern) {
    throw skillError('E2002', 'grep pattern is required');
  }

  if (request.patternType !== 'literal') {
    compileGrepRegex(pattern, {
      patternType: request.patternType ?? 'regex',
      caseInsensitive: request.caseInsensitive,
    });
  }

  if (opts.toolInvoke) {
    const res = await opts.toolInvoke.invoke({
      capability: 'skill:filesystem',
      method: 'grep',
      args: {
        pattern,
        ...(request.path ? { path: request.path } : {}),
        ...(request.glob ? { glob: request.glob } : {}),
        ...(request.patternType ? { patternType: request.patternType } : {}),
        ...(request.caseInsensitive !== undefined
          ? { caseInsensitive: request.caseInsensitive }
          : {}),
        ...(request.maxResults !== undefined ? { maxResults: request.maxResults } : {}),
      },
      scanRoots: opts.scanRoots,
      timeoutMs: opts.timeoutMs ?? 60_000,
    });
    if (res.status !== 'success') {
      throw skillError(res.errorCode ?? 'E1041', res.errorMessage ?? 'grep failed');
    }
    const result = res.result as GrepResult | undefined;
    return {
      matches: Array.isArray(result?.matches) ? result.matches : [],
      ...(result?.grepFallback ? { grepFallback: true } : {}),
    };
  }

  return grepLocal(request, opts.scanRoots);
}
