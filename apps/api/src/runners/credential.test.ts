import { describe, expect, it } from "vitest";
import {
  generateRunnerCredential,
  hashRunnerCredential,
  verifyRunnerCredential,
} from "./credential.js";

describe("runner credential helpers", () => {
  it("hash is deterministic", () => {
    const credential = "test-credential-value";
    expect(hashRunnerCredential(credential)).toBe(
      hashRunnerCredential(credential),
    );
  });

  it("verify passes for correct credential", () => {
    const credential = generateRunnerCredential();
    const storedHash = hashRunnerCredential(credential);
    expect(verifyRunnerCredential(credential, storedHash)).toBe(true);
  });

  it("verify fails for wrong credential", () => {
    const credential = generateRunnerCredential();
    const storedHash = hashRunnerCredential(credential);
    expect(verifyRunnerCredential("wrong-credential", storedHash)).toBe(false);
  });
});
