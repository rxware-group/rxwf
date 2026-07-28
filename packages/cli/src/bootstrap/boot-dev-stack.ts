import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { StartupError } from "../errors.js";
import { applyRuntimeEnv } from "./apply-runtime-env.js";
import { repoRoot } from "../repo-root.js";
import type { RuntimeBootstrapConfig } from "../types.js";

export interface BootDevStackResult {
  exitCode: number;
}

function spawnPnpm(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): ChildProcess {
  return spawn("pnpm", args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

async function runCommand(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args, options);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 0);
    });
  });
}

async function runPredev(): Promise<void> {
  const code = await runCommand(["run", "predev"], { cwd: repoRoot });
  if (code !== 0) {
    throw new StartupError(
      "AWF-START-009",
      "predev failed. Fix build errors and retry.",
    );
  }
}

function killChild(child: ChildProcess | undefined): void {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // process may already be gone
  }
}

export async function bootDevStack(
  cfg: RuntimeBootstrapConfig,
): Promise<BootDevStackResult> {
  if (cfg.withWeb) {
    await runPredev();
  }

  const env = applyRuntimeEnv(cfg);
  const apiEntry = join(repoRoot, "apps", "api", "src", "main.ts");
  const apiDir = join(repoRoot, "apps", "api");

  let apiChild: ChildProcess | undefined;
  let webChild: ChildProcess | undefined;
  let settled = false;

  return new Promise((resolve) => {
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      killChild(webChild);
      killChild(apiChild);
      resolve({ exitCode });
    };

    const onSignal = () => {
      finish(0);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    apiChild = spawn("pnpm", ["exec", "tsx", apiEntry], {
      cwd: apiDir,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    apiChild.on("error", (err) => {
      console.error("Failed to start API:", err);
      finish(1);
    });

    apiChild.on("exit", (code, signal) => {
      if (settled) return;
      if (signal) {
        finish(1);
        return;
      }
      const exitCode = code ?? 0;
      if (cfg.withWeb) {
        killChild(webChild);
        finish(exitCode);
        return;
      }
      finish(exitCode);
    });

    if (cfg.withWeb) {
      webChild = spawnPnpm(
        ["--filter", "@rxwf/web", "run", "dev:wait"],
        { cwd: repoRoot },
      );

      webChild.on("error", (err) => {
        console.error("Failed to start Web:", err);
        finish(1);
      });

      webChild.on("exit", (code, signal) => {
        if (settled) return;
        if (signal) {
          finish(1);
          return;
        }
        killChild(apiChild);
        finish(code ?? 0);
      });
    }
  });
}
