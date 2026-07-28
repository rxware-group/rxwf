import { describe, expect, it, vi } from "vitest";
import type { RemoteNodeRunJob } from "@rxwf/runner-protocol";
import { E2011 } from "@rxwf/runner-protocol";
import { AwfError } from "@rxwf/shared";
import { createInMemoryRunnerGateway } from "./runner-gateway.js";

const minimalJob: RemoteNodeRunJob = {
  jobId: "job-1",
  executionId: "exec-1",
  nodeRunId: "nr-1",
  nodeType: "code",
  nodeConfig: {},
  inputItems: [],
  mode: "production",
  workflowSettings: {},
  timeoutMs: 5000,
};

describe("InMemoryRunnerGateway", () => {
  it("dispatchAndWait resolves when agent sends job.result", async () => {
    const gw = createInMemoryRunnerGateway();
    const sent: unknown[] = [];
    gw.registerConnection("r1", {
      send: (m) => sent.push(m),
      close: () => {},
    });

    const resultPromise = gw.dispatchAndWait("r1", minimalJob, {
      timeoutMs: 5000,
    });
    const assign = sent.find(
      (m) => (m as { type?: string }).type === "job.assign",
    ) as { id?: string } | undefined;
    expect(assign).toBeDefined();
    expect(assign?.id).toBe("job-1");

    gw.handleIncomingMessage("r1", {
      type: "job.result",
      id: "job-1",
      payload: {
        jobId: "job-1",
        status: "success",
        outputItems: [[]],
        durationMs: 12,
      },
    });

    await expect(resultPromise).resolves.toMatchObject({
      status: "success",
      jobId: "job-1",
    });
  });

  it("timeout rejects with E2011", async () => {
    const gw = createInMemoryRunnerGateway();
    gw.registerConnection("r1", {
      send: () => {},
      close: () => {},
    });

    const resultPromise = gw.dispatchAndWait("r1", minimalJob, {
      timeoutMs: 30,
    });

    await expect(resultPromise).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AwfError && err.code === E2011,
    );
  });

  it("single-active kicks old connection", () => {
    const gw = createInMemoryRunnerGateway();
    const sent1: unknown[] = [];
    const close1 = vi.fn();
    gw.registerConnection("r1", {
      send: (m) => sent1.push(m),
      close: close1,
    });

    gw.registerConnection("r1", {
      send: () => {},
      close: () => {},
    });

    expect(
      sent1.some((m) => (m as { type?: string }).type === "auth.fail"),
    ).toBe(true);
    expect(close1).toHaveBeenCalled();
    expect(gw.isConnected("r1")).toBe(true);
  });

  it("presence stores crewai sidecar url for connected runner", () => {
    const gw = createInMemoryRunnerGateway();
    gw.registerConnection("r1", {
      send: () => {},
      close: () => {},
    });

    gw.handleIncomingMessage("r1", {
      type: "presence",
      payload: {
        runningJobs: 0,
        crewaiSidecarUrl: "http://192.168.1.10:8071",
      },
    });

    expect(gw.listOnlineCrewAiSidecarUrls()).toEqual(["http://192.168.1.10:8071"]);
  });

  it("unregister clears advertised crewai sidecar url", () => {
    const gw = createInMemoryRunnerGateway();
    gw.registerConnection("r1", {
      send: () => {},
      close: () => {},
    });
    gw.handleIncomingMessage("r1", {
      type: "presence",
      payload: { runningJobs: 0, crewaiSidecarUrl: "http://127.0.0.1:8071" },
    });
    gw.unregisterConnection("r1");
    expect(gw.listOnlineCrewAiSidecarUrls()).toEqual([]);
  });

  it("getCrewAiSidecarUrl returns url for connected runner", () => {
    const gw = createInMemoryRunnerGateway();
    gw.registerConnection("r1", {
      send: () => {},
      close: () => {},
    });
    gw.handleIncomingMessage("r1", {
      type: "presence",
      payload: { runningJobs: 0, crewaiSidecarUrl: "http://127.0.0.1:8071" },
    });
    expect(gw.getCrewAiSidecarUrl("r1")).toBe("http://127.0.0.1:8071");
  });
});
