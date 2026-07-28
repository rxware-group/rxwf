import { describe, expect, it } from "vitest";
import { resolveConfig, resolveCrewAiPortBinding } from "./resolve-config.js";

describe("resolveConfig", () => {
  it("defaults to lite when mode omitted", () => {
    const cfg = resolveConfig({}, {});
    expect(cfg.mode).toBe("lite");
    expect(cfg.deployProfile).toBe("lite");
  });

  it("CLI postgres-url overrides env", () => {
    const cfg = resolveConfig(
      {
        mode: "standard",
        postgresUrl: "postgres://u:p@h:5432/db",
      },
      { RXWF_DATABASE_URL: "postgres://other:x@h:5432/db" },
    );
    expect(cfg.postgresUrl).toBe("postgres://u:p@h:5432/db");
  });

  it("reads redis from env when args omit it", () => {
    const cfg = resolveConfig(
      { mode: "standard" },
      { RXWF_REDIS_URL: "redis://:x@127.0.0.1:6379/0" },
    );
    expect(cfg.redisUrl).toBe("redis://:x@127.0.0.1:6379/0");
  });

  it("defaults depsLifecycle to keep", () => {
    const cfg = resolveConfig({ mode: "standard" }, {});
    expect(cfg.depsLifecycle).toBe("keep");
  });

  it("defaults withWeb to false", () => {
    const cfg = resolveConfig({}, {});
    expect(cfg.withWeb).toBe(false);
  });

  it("passes withWeb when set in args", () => {
    const cfg = resolveConfig({ withWeb: true }, {});
    expect(cfg.withWeb).toBe(true);
  });

  it("defaults crewai port binding to 127.0.0.1:8071", () => {
    expect(resolveCrewAiPortBinding({})).toBe("127.0.0.1:8071:8071");
    const cfg = resolveConfig({}, {});
    expect(cfg.crewaiPortBinding).toBe("127.0.0.1:8071:8071");
    expect(cfg.crewaiOverlayFile).toMatch(/docker-compose\.crewai\.yml$/);
  });

  it("reads crewai url from env and withCrewai from args", () => {
    const cfg = resolveConfig(
      { withCrewai: true, crewaiUrl: "http://127.0.0.1:9000" },
      { CREWAI_RUNNER_URL: "http://127.0.0.1:8071" },
    );
    expect(cfg.withCrewai).toBe(true);
    expect(cfg.crewaiUrl).toBe("http://127.0.0.1:9000");
  });
});
