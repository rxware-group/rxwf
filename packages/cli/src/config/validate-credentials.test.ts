import { describe, expect, it } from "vitest";
import { StartupError } from "../errors.js";
import { validateStandardCredentials } from "./validate-credentials.js";

describe("validateStandardCredentials", () => {
  it("rejects postgres url without password", () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: "postgres://user@localhost:5432/rxwf",
        redisUrl: "redis://:secret@localhost:6379/0",
      }),
    ).toThrow(StartupError);
  });

  it("rejects redis url without password", () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: "postgres://u:p@localhost:5432/rxwf",
        redisUrl: "redis://localhost:6379/0",
      }),
    ).toThrow(StartupError);
  });

  it("passes when both have credentials", () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: "postgres://u:p@localhost:5432/rxwf",
        redisUrl: "redis://:secret@localhost:6379/0",
      }),
    ).not.toThrow();
  });
});
