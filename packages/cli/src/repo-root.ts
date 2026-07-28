import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up from `startDir` until `pnpm-workspace.yaml` is found. */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not find monorepo root (pnpm-workspace.yaml)");
    }
    dir = parent;
  }
}

export const repoRoot = findRepoRoot(
  dirname(fileURLToPath(import.meta.url)),
);
