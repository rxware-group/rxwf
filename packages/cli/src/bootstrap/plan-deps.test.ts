import { describe, expect, it } from "vitest";
import { planDeps } from "./plan-deps.js";
import type { RuntimeBootstrapConfig } from "../types.js";

function base(overrides: Partial<RuntimeBootstrapConfig>): RuntimeBootstrapConfig {
  return {
    mode: "standard",
    deployProfile: "standard",
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

describe("planDeps", () => {
  it("lite needs no deps", () => {
    expect(planDeps(base({ mode: "lite", deployProfile: "lite" }))).toEqual({
      needRedis: false,
      needPostgres: false,
    });
  });

  it("standard with only postgres url needs redis only", () => {
    expect(
      planDeps(
        base({
          postgresUrl: "postgres://u:p@h:5432/db",
        }),
      ),
    ).toEqual({ needRedis: true, needPostgres: false });
  });

  it("standard with both urls needs nothing", () => {
    expect(
      planDeps(
        base({
          postgresUrl: "postgres://u:p@h:5432/db",
          redisUrl: "redis://:x@h:6379/0",
        }),
      ),
    ).toEqual({ needRedis: false, needPostgres: false });
  });
});
