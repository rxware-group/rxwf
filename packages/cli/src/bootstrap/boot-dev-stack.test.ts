import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeBootstrapConfig } from "../types.js";

const spawnCalls: Array<{ command: string; args: string[]; cwd?: string }> =
  [];

function mockChild() {
  const child = new EventEmitter() as EventEmitter & {
    killed: boolean;
    exitCode: number | null;
    kill: ReturnType<typeof vi.fn>;
  };
  child.killed = false;
  child.exitCode = null;
  child.kill = vi.fn();
  return child;
}

vi.mock("node:child_process", () => ({
  spawn: vi.fn(
    (
      command: string,
      args: string[],
      options?: { cwd?: string },
    ) => {
      spawnCalls.push({ command, args, cwd: options?.cwd });
      const child = mockChild();
      queueMicrotask(() => {
        if (command === "pnpm" && args[0] === "run" && args[1] === "predev") {
          child.emit("exit", 0, null);
          return;
        }
        if (
          command === "pnpm" &&
          args.includes("@rxwf/web") &&
          args.includes("dev:wait")
        ) {
          child.emit("exit", 0, null);
          return;
        }
        if (command === "pnpm" && args.includes("tsx")) {
          child.emit("exit", 0, null);
        }
      });
      return child;
    },
  ),
}));

function baseConfig(
  overrides: Partial<RuntimeBootstrapConfig> = {},
): RuntimeBootstrapConfig {
  return {
    mode: "lite",
    deployProfile: "lite",
    sqlitePath: "/tmp/rxwf.db",
    noDockerAuto: false,
    autoPort: false,
    withWeb: false,
    depsLifecycle: "keep",
    startupTimeoutSec: 60,
    withCrewai: false,
    crewaiPortBinding: "127.0.0.1:8071:8071",
    crewaiOverlayFile: "/crewai.yml",
    dockerComposeFile: "/compose.yml",
    ...overrides,
  };
}

describe("bootDevStack", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
    vi.clearAllMocks();
  });

  it("spawns only API when withWeb is false", async () => {
    const { bootDevStack } = await import("./boot-dev-stack.js");
    const result = await bootDevStack(baseConfig());
    expect(result.exitCode).toBe(0);
    expect(spawnCalls.some((c) => c.args.includes("predev"))).toBe(false);
    expect(spawnCalls.some((c) => c.args.includes("tsx"))).toBe(true);
    expect(
      spawnCalls.some(
        (c) =>
          c.args.includes("@rxwf/web") &&
          c.args.includes("dev:wait"),
      ),
    ).toBe(false);
  });

  it("runs predev, API, and dev:wait when withWeb is true", async () => {
    const { bootDevStack } = await import("./boot-dev-stack.js");
    const result = await bootDevStack(baseConfig({ withWeb: true }));
    expect(result.exitCode).toBe(0);

    const predevIdx = spawnCalls.findIndex(
      (c) => c.args[0] === "run" && c.args[1] === "predev",
    );
    const apiIdx = spawnCalls.findIndex((c) => c.args.includes("tsx"));
    const webIdx = spawnCalls.findIndex(
      (c) =>
        c.args.includes("@rxwf/web") && c.args.includes("dev:wait"),
    );

    expect(predevIdx).toBeGreaterThanOrEqual(0);
    expect(apiIdx).toBeGreaterThan(predevIdx);
    expect(webIdx).toBeGreaterThan(apiIdx);
  });
});
