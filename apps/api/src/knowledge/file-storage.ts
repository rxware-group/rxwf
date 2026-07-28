import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function createKnowledgeFileStorage(dataDir: string) {
  const root = join(dataDir, 'uploads');

  return {
    async writeFile(relativePath: string, data: Buffer): Promise<string> {
      const full = join(root, relativePath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, data);
      return relativePath;
    },

    async readFile(relativePath: string): Promise<Buffer> {
      return readFile(join(root, relativePath));
    },

    async deleteFile(relativePath: string): Promise<void> {
      await unlink(join(root, relativePath)).catch(() => undefined);
    },
  };
}
