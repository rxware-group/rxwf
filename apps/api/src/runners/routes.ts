import type { LiteDatabase } from "@rxwf/providers-lite";
import { createLiteRunnerRepository } from "@rxwf/providers-lite";
import { AwfError } from "@rxwf/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { runnerGateway } from "./gateway-instance.js";
import { createInMemoryRunnerGateway } from "./runner-gateway.js";
import { createRunnerRegistrationService } from "./registration-service.js";

type RunnerOs = "windows" | "linux" | "macos";
type RunnerArch = "x64" | "arm64" | "arm";
type RunnerPlatform = {
  os: RunnerOs;
  arch: RunnerArch;
  osVersion?: string;
};
type RunnerRecord = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createLiteRunnerRepository>["findById"]>>
>;

const VALID_OS = new Set<RunnerOs>(["windows", "linux", "macos"]);
const VALID_ARCH = new Set<RunnerArch>(["x64", "arm64", "arm"]);

function toRunnerSummary(
  r: RunnerRecord,
  gateway: ReturnType<typeof createInMemoryRunnerGateway>,
) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    platform: r.platform,
    status: r.status,
    capabilities: r.capabilities,
    maxConcurrent: r.maxConcurrent,
    runningJobs: r.runningJobs,
    labels: r.labels ?? [],
    agentVersion: r.agentVersion ?? null,
    lastHeartbeatAt: r.lastHeartbeatAt?.toISOString() ?? null,
    crewaiSidecarUrl: gateway.getCrewAiSidecarUrl(r.id) ?? null,
  };
}

function parsePlatform(
  platform: unknown,
): { ok: true; value: RunnerPlatform } | { ok: false } {
  if (!platform || typeof platform !== "object") {
    return { ok: false };
  }
  const p = platform as Record<string, unknown>;
  if (typeof p.os !== "string" || !VALID_OS.has(p.os as RunnerOs)) {
    return { ok: false };
  }
  if (typeof p.arch !== "string" || !VALID_ARCH.has(p.arch as RunnerArch)) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      os: p.os as RunnerOs,
      arch: p.arch as RunnerArch,
      ...(typeof p.osVersion === "string" ? { osVersion: p.osVersion } : {}),
    },
  };
}

function sendAwfError(reply: FastifyReply, err: unknown): unknown {
  if (err instanceof AwfError) {
    const status =
      err.code === "E2014" || err.code === "E2013"
        ? 401
        : err.code === "E1001"
          ? 404
          : 400;
    return reply.status(status).send({ code: err.code, message: err.message });
  }
  throw err;
}

function extractRunnerCredential(
  request: FastifyRequest,
): string | undefined {
  const header =
    request.headers["x-runner-credential"] ??
    request.headers["X-Runner-Credential"];
  if (typeof header === "string" && header.length > 0) {
    return header;
  }
  const body = request.body as { runnerCredential?: string } | undefined;
  return body?.runnerCredential;
}

export function registerRunnerRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  gateway: ReturnType<typeof createInMemoryRunnerGateway> = runnerGateway,
): void {
  const runnerRepo = createLiteRunnerRepository(db);
  const registrationService = createRunnerRegistrationService({ db });

  const requireAdmin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== "admin") {
      await reply
        .status(403)
        .send({ code: "E5002", message: "Admin required" });
    }
  };

  app.get(
    "/api/runners",
    { preHandler: authPreHandler },
    async () => {
      const list = await runnerRepo.listAll();
      return { runners: list.map((r) => toRunnerSummary(r, gateway)) };
    },
  );

  app.post(
    "/api/runners/registration-tokens",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body as {
        expiresInHours?: number;
        labels?: string[];
      } | null;
      try {
        const result = await registrationService.createRegistrationToken(
          request.auth!.userId,
          {
            expiresInHours: body?.expiresInHours,
            labels: body?.labels,
          },
        );
        return reply.status(201).send({
          registrationToken: result.registrationToken,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.post("/api/runners/register", async (request, reply) => {
    const body = request.body as {
      registrationToken?: string;
      name?: string;
      platform?: unknown;
      labels?: string[];
      capabilities?: string[];
      maxConcurrent?: number;
      agentVersion?: string;
    } | null;

    if (!body?.registrationToken || !body?.name) {
      return reply.status(400).send({
        code: "E1001",
        message: "registrationToken and name are required",
      });
    }

    const platform = parsePlatform(body.platform);
    if (!platform.ok) {
      return reply.status(400).send({
        code: "E1001",
        message:
          "platform.os must be windows|linux|macos and platform.arch must be x64|arm64|arm",
      });
    }

    try {
      const result = await registrationService.registerAgent({
        registrationToken: body.registrationToken,
        name: body.name,
        platform: platform.value,
        labels: body.labels,
        capabilities: body.capabilities,
        maxConcurrent: body.maxConcurrent,
        agentVersion: body.agentVersion,
      });
      return reply.status(201).send(result);
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.delete(
    "/api/runners/:runnerId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { runnerId } = request.params as { runnerId: string };
      try {
        if (gateway.isConnected(runnerId)) {
          gateway.kickConnection(runnerId, "Runner revoked");
        }
        await registrationService.revokeRunner(runnerId);
        return reply.status(204).send();
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.post(
    "/api/runners/:runnerId/drain",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { runnerId } = request.params as { runnerId: string };
      try {
        const runner = await registrationService.drainRunner(runnerId);
        gateway.notifyDrain(runnerId);
        return reply.status(200).send(toRunnerSummary(runner, gateway));
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.post(
    "/api/runners/:runnerId/rotate-credential",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { runnerId } = request.params as { runnerId: string };
      try {
        const result = await registrationService.rotateCredential(runnerId);
        gateway.kickConnection(runnerId, "Credential rotated");
        return reply.status(200).send(result);
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.post("/api/runners/:runnerId/heartbeat", async (request, reply) => {
    const { runnerId } = request.params as { runnerId: string };
    const credential = extractRunnerCredential(request);
    if (!credential) {
      return reply.status(401).send({
        code: "E2013",
        message: "Runner credential required",
      });
    }

    const runner = await runnerRepo.findById(runnerId);
    if (!runner) {
      return reply.status(404).send({
        code: "E1001",
        message: "Runner not found",
      });
    }

    const valid = await runnerRepo.verifyCredential(runnerId, credential);
    if (!valid) {
      return reply.status(401).send({
        code: "E2013",
        message: "Runner authentication failed",
      });
    }

    const body = request.body as { runningJobs?: number } | undefined;
    const runningJobs =
      typeof body?.runningJobs === "number" ? body.runningJobs : 0;
    await runnerRepo.updatePresence(runnerId, runningJobs);
    return reply.status(204).send();
  });
}
