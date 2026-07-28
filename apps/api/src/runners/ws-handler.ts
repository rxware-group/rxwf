import websocket from "@fastify/websocket";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { createLiteRunnerRepository } from "@rxwf/providers-lite";
import type { RunnerGatewayPort } from "@rxwf/providers-contracts";
import type {
  RunnerAuthPayload,
  RunnerPresencePayload,
  RunnerWsEnvelope,
} from "@rxwf/runner-protocol";
import type { FastifyInstance } from "fastify";

const AUTH_TIMEOUT_MS = 5_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

type RunnerGatewayWithHandler = RunnerGatewayPort & {
  handleIncomingMessage(runnerId: string, envelope: RunnerWsEnvelope): void;
};

function parseEnvelope(raw: unknown): RunnerWsEnvelope | null {
  try {
    const text = typeof raw === "string" ? raw : raw?.toString();
    if (!text) return null;
    const parsed = JSON.parse(text) as RunnerWsEnvelope;
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function registerRunnerWebSocket(
  app: FastifyInstance,
  deps: { db: LiteDatabase; gateway: RunnerGatewayWithHandler },
): Promise<void> {
  await app.register(websocket);

  const runnerRepo = createLiteRunnerRepository(deps.db);

  app.get(
    "/api/runners/:runnerId/stream",
    { websocket: true },
    (socket, request) => {
      const { runnerId } = request.params as { runnerId: string };
      let authenticated = false;
      let authTimer: ReturnType<typeof setTimeout> | undefined;

      const sendJson = (envelope: RunnerWsEnvelope) => {
        socket.send(JSON.stringify(envelope));
      };

      const failAuth = (errorCode: string, message: string) => {
        sendJson({
          type: "auth.fail",
          ts: new Date().toISOString(),
          payload: { errorCode, message },
        });
        socket.close(1008, message);
      };

      authTimer = setTimeout(() => {
        if (!authenticated) {
          failAuth("E2013", "Authentication timeout");
        }
      }, AUTH_TIMEOUT_MS);

      socket.on("message", async (raw) => {
        const envelope = parseEnvelope(raw);
        if (!envelope) return;

        if (!authenticated) {
          if (envelope.type !== "auth") {
            failAuth("E2013", "Expected auth message");
            return;
          }

          const payload = envelope.payload as RunnerAuthPayload | undefined;
          const credential = payload?.runnerCredential;
          if (!credential) {
            failAuth("E2013", "Runner credential required");
            return;
          }

          const runner = await runnerRepo.findById(runnerId);
          if (!runner) {
            failAuth("E1001", "Runner not found");
            return;
          }

          const valid = await runnerRepo.verifyCredential(runnerId, credential);
          if (!valid) {
            failAuth("E2013", "Runner authentication failed");
            return;
          }

          clearTimeout(authTimer);
          authenticated = true;

          sendJson({
            type: "auth.ok",
            ts: new Date().toISOString(),
            payload: {
              serverTime: new Date().toISOString(),
              heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
              maxConcurrent: runner.maxConcurrent,
            },
          });

          await runnerRepo.setStatus(runnerId, "online");

          deps.gateway.registerConnection(runnerId, {
            send: (msg) => sendJson(msg as RunnerWsEnvelope),
            close: (code, reason) => socket.close(code ?? 1000, reason),
          });
          return;
        }

        if (envelope.type === "presence") {
          const payload = envelope.payload as RunnerPresencePayload | undefined;
          const runningJobs =
            typeof payload?.runningJobs === "number" ? payload.runningJobs : 0;
          await runnerRepo.updatePresence(runnerId, runningJobs);
        } else if (envelope.type === "pong") {
          const runner = await runnerRepo.findById(runnerId);
          await runnerRepo.updatePresence(
            runnerId,
            runner?.runningJobs ?? 0,
          );
        }

        deps.gateway.handleIncomingMessage(runnerId, envelope);
      });

      socket.on("close", async () => {
        clearTimeout(authTimer);
        if (!authenticated) return;
        deps.gateway.unregisterConnection(runnerId);
        await runnerRepo.setStatus(runnerId, "offline");
      });
    },
  );
}
