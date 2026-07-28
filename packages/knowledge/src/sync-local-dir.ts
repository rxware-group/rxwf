import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED_EXT = new Set(['.txt', '.md', '.html', '.htm', '.pdf']);

export function listSyncableFiles(rootPath: string): Array<{ fileName: string; absolutePath: string }> {
  const out: Array<{ fileName: string; absolutePath: string }> = [];

  function walk(dir: string, prefix: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const absolutePath = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      let st;
      try {
        st = statSync(absolutePath);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(absolutePath, rel);
        continue;
      }
      const lower = name.toLowerCase();
      const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
      if (!ALLOWED_EXT.has(ext)) continue;
      out.push({ fileName: rel, absolutePath });
    }
  }

  walk(rootPath, '');
  return out;
}

export function readSyncFile(absolutePath: string): Buffer {
  return readFileSync(absolutePath);
}
