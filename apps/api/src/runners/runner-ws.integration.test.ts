import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { createTestDb } from "@rxwf/providers-lite";
import type { RemoteNodeRunJob } from "@rxwf/runner-protocol";
import { createAuthService, createUserService } from "@rxwf/identity";
import { buildApp } from "../app.js";
import { runnerGateway } from "./gateway-instance.js";

const minimalJob: RemoteNodeRunJob = {
  jobId: "job-ws-1",
  executionId: "exec-1",
  nodeRunId: "nr-1",
  nodeType: "code",
  nodeConfig: {},
  inputItems: [],
  mode: "production",
  workflowSettings: {},
  timeoutMs: 5000,
};

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `runner-ws-${crypto.randomUUID()}@example.com`,
    password: "secret",
    role: "admin",
  });
  const { key } = await auth.createApiKey(user.id, "test");
  return key;
}

async function registerAgent(
  app: Awaited<ReturnType<typeof buildApp>>["app"],
  key: string,
) {
  const tokenRes = await app.inject({
    method: "POST",
    url: "/api/runners/registration-tokens",
    headers: { "x-api-key": key },
    payload: { labels: ["gpu"] },
  });
  expect(tokenRes.statusCode).toBe(201);
  const { registrationToken } = tokenRes.json() as {
    registrationToken: string;
  };

  const registerRes = await app.inject({
    method: "POST",
    url: "/api/runners/register",
    payload: {
      registrationToken,
      name: "ws-agent",
      platform: { os: "linux", arch: "x64" },
      capabilities: ["code"],
      agentVersion: "1.0.0",
    },
  });
  expect(registerRes.statusCode).toBe(201);
  return registerRes.json() as {
    runnerId: string;
    runnerCredential: string;
  };
}

function waitForWsMessage(
  ws: WebSocket,
  type: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === type) {
          ws.off("message", onMessage);
          resolve(msg);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.on("message", onMessage);
    ws.once("error", reject);
    ws.once("close", () =>
      reject(new Error(`WebSocket closed before ${type}`)),
    );
  });
}

function waitForWsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function waitForWsClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
  });
}

describe("runner websocket integration", () => {
  it(
    "connects, authenticates, dispatches job, returns result",
    async () => {
      const db = await createTestDb();
      const { app } = await buildApp({
        db,
        disableScheduler: true,
        disableJobProcessor: true,
      });
      const key = await adminKey(db);
      const { runnerId, runnerCredential } = await registerAgent(app, key);

      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;

      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/api/runners/${runnerId}/stream`,
      );

      try {
        await waitForWsOpen(ws);

        ws.send(
          JSON.stringify({
            type: "auth",
            ts: new Date().toISOString(),
            payload: { runnerCredential },
          }),
        );

        const authOk = await waitForWsMessage(ws, "auth.ok");
        expect(authOk).toMatchObject({ type: "auth.ok" });
        expect(runnerGateway.isConnected(runnerId)).toBe(true);

        const assignPromise = waitForWsMessage(ws, "job.assign").then(
          (assign) => {
            expect(assign).toMatchObject({
              type: "job.assign",
              id: minimalJob.jobId,
            });
            ws.send(
              JSON.stringify({
                type: "job.result",
                id: minimalJob.jobId,
                ts: new Date().toISOString(),
                payload: {
                  jobId: minimalJob.jobId,
                  status: "success",
                  outputItems: [[]],
                  durationMs: 42,
                },
              }),
            );
          },
        );

        const dispatchPromise = runnerGateway.dispatchAndWait(
          runnerId,
          minimalJob,
          { timeoutMs: 5000 },
        );

        const [result] = await Promise.all([dispatchPromise, assignPromise]);
        expect(result).toMatchObject({
          status: "success",
          jobId: minimalJob.jobId,
        });

        ws.close();
        await waitForWsClose(ws);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(runnerGateway.isConnected(runnerId)).toBe(false);

        const listRes = await app.inject({
          method: "GET",
          url: "/api/runners",
          headers: { "x-api-key": key },
        });
        expect(listRes.statusCode).toBe(200);
        const listBody = listRes.json() as {
          runners: Array<{ id: string; status: string }>;
        };
        const runner = listBody.runners.find((r) => r.id === runnerId);
        expect(runner?.status).toBe("offline");
      } finally {
        ws.removeAllListeners();
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.terminate();
        }
        await app.close();
      }
    },
    15000,
  );
});
