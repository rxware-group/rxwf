import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const primaryDir = process.env.RXWF_DATA_DIR ?? join(repoRoot, 'data');

/** Older dev runs stored SQLite under apps/api when cwd was apps/api */
const legacyDb = join(repoRoot, 'apps', 'api', 'data', 'rxwf.db');

const targets = [join(primaryDir, 'rxwf.db'), legacyDb];

let failed = false;
for (const dbPath of targets) {
  try {
    await rm(dbPath, { force: true });
    console.log(`已删除 ${dbPath}`);
  } catch (err) {
    failed = true;
    const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
    console.error(`删除失败 ${dbPath}:`, err);
    if (code === 'EBUSY') {
      console.error('数据库文件被占用：请先 Ctrl+C 停止正在运行的 pnpm dev，再执行 pnpm reset:data');
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('请重新执行 pnpm dev，浏览器将显示「创建管理员」页面。');
