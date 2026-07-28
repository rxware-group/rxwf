import { readdir, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { platform } from 'node:os';

export type BrowseEntryKind = 'directory' | 'file';

export interface BrowseFsEntry {
  name: string;
  path: string;
  kind: BrowseEntryKind;
}

export interface BrowseFsResult {
  path: string;
  parent: string | null;
  entries: BrowseFsEntry[];
  host: 'controlPlane' | 'runner';
  runnerId?: string;
}

function windowsDriveRoots(): BrowseFsEntry[] {
  const drives: BrowseFsEntry[] = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const root = `${letter}:\\`;
    drives.push({ name: root, path: root, kind: 'directory' });
  }
  return drives;
}

export async function listLocalDirectory(options: {
  path?: string;
  dirsOnly?: boolean;
  host: 'controlPlane' | 'runner';
  runnerId?: string;
}): Promise<BrowseFsResult> {
  const dirsOnly = options.dirsOnly !== false;
  const raw = (options.path ?? '').trim();

  if (platform() === 'win32' && raw === '') {
    return {
      path: '',
      parent: null,
      entries: windowsDriveRoots(),
      host: options.host,
      ...(options.runnerId ? { runnerId: options.runnerId } : {}),
    };
  }

  const target = resolve(raw || '/');
  let abs: string;
  try {
    abs = await realpath(target);
  } catch {
    abs = target;
  }

  const info = await stat(abs);
  if (!info.isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }

  const dirents = await readdir(abs, { withFileTypes: true });
  const entries: BrowseFsEntry[] = [];
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
    parentDir === abs || (platform() === 'win32' && /^[A-Za-z]:\\?$/.test(abs))
      ? platform() === 'win32'
        ? ''
        : null
      : parentDir;

  return {
    path: abs,
    parent,
    entries,
    host: options.host,
    ...(options.runnerId ? { runnerId: options.runnerId } : {}),
  };
}
