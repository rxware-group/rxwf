import type { LiteDatabase } from "@rxwf/providers-lite";
import {
  createLiteRunnerRepository,
  createRunnerRegistrationRepository,
} from "@rxwf/providers-lite";
import { AwfError } from "@rxwf/shared";
import {
  generateRunnerCredential,
  hashRunnerCredential,
} from "./credential.js";

type RunnerPlatform = {
  os: "windows" | "linux" | "macos";
  arch: "x64" | "arm64" | "arm";
  osVersion?: string;
};

type RunnerRecord = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createLiteRunnerRepository>["findById"]>>
>;

const DEFAULT_TOKEN_EXPIRES_HOURS = 24;

export function createRunnerRegistrationService(deps: { db: LiteDatabase }) {
  const registrationRepo = createRunnerRegistrationRepository(deps.db);
  const runnerRepo = createLiteRunnerRepository(deps.db);

  return {
    async createRegistrationToken(
      userId: string,
      opts?: { expiresInHours?: number; labels?: string[] },
    ): Promise<{ registrationToken: string; expiresAt: Date }> {
      const hours = opts?.expiresInHours ?? DEFAULT_TOKEN_EXPIRES_HOURS;
      const expiresAt = new Date(Date.now() + hours * 3_600_000);
      const { token, expiresAt: tokenExpiresAt } =
        await registrationRepo.createToken({
          expiresAt,
          createdBy: userId,
          labelsDefault: opts?.labels,
        });
      return { registrationToken: token, expiresAt: tokenExpiresAt };
    },

    async registerAgent(body: {
      registrationToken: string;
      name: string;
      platform: RunnerPlatform;
      labels?: string[];
      capabilities?: string[];
      maxConcurrent?: number;
      agentVersion?: string;
    }): Promise<{ runnerId: string; runnerCredential: string }> {
      const consumed = await registrationRepo.consumeToken(
        body.registrationToken,
      );
      if (!consumed) {
        throw new AwfError("E2014", "Registration token invalid or expired");
      }

      const runnerCredential = generateRunnerCredential();
      const credentialHash = hashRunnerCredential(runnerCredential);
      const labels =
        body.labels !== undefined ? body.labels : consumed.labelsDefault;
      const capabilities = body.capabilities ?? [];

      const runner = await runnerRepo.registerAgent(
        {
          name: body.name,
          platform: body.platform,
          labels,
          capabilities,
          maxConcurrent: body.maxConcurrent,
          agentVersion: body.agentVersion,
        },
        credentialHash,
      );

      return { runnerId: runner.id, runnerCredential };
    },

    async revokeRunner(runnerId: string): Promise<void> {
      await runnerRepo.revokeAgent(runnerId);
    },

    async drainRunner(runnerId: string): Promise<RunnerRecord> {
      const existing = await runnerRepo.findById(runnerId);
      if (!existing) {
        throw new AwfError("E1001", "Runner not found");
      }
      await runnerRepo.setStatus(runnerId, "draining");
      const updated = await runnerRepo.findById(runnerId);
      if (!updated) {
        throw new AwfError("E1001", "Runner not found");
      }
      return updated;
    },

    async rotateCredential(
      runnerId: string,
    ): Promise<{ runnerCredential: string }> {
      const existing = await runnerRepo.findById(runnerId);
      if (!existing) {
        throw new AwfError("E1001", "Runner not found");
      }
      const runnerCredential = generateRunnerCredential();
      await runnerRepo.rotateCredential(
        runnerId,
        hashRunnerCredential(runnerCredential),
      );
      return { runnerCredential };
    },
  };
}

export type RunnerRegistrationService = ReturnType<
  typeof createRunnerRegistrationService
>;
