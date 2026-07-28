import { probeCrewAiHealth } from "../infra/crewai-health.js";
import { ensureCrewAiRunner } from "../infra/docker-manager.js";
import type { RuntimeBootstrapConfig } from "../types.js";

export async function prepareCrewAiSidecar(
  cfg: RuntimeBootstrapConfig,
): Promise<{ cfg: RuntimeBootstrapConfig; dockerDeployed: boolean }> {
  if (!cfg.withCrewai) {
    return { cfg, dockerDeployed: false };
  }

  const existingUrl = cfg.crewaiUrl;
  if (existingUrl) {
    await probeCrewAiHealth(existingUrl, cfg.startupTimeoutSec);
    cfg.crewaiRunnerUrl = existingUrl;
    process.env.CREWAI_RUNNER_URL = existingUrl;
    return { cfg, dockerDeployed: false };
  }

  const deployed = await ensureCrewAiRunner({
    standardComposeFile: cfg.dockerComposeFile,
    crewaiOverlayFile: cfg.crewaiOverlayFile,
    portBinding: cfg.crewaiPortBinding,
    timeoutSec: cfg.startupTimeoutSec,
    image: cfg.crewaiImage,
  });

  cfg.crewaiRunnerUrl = deployed.url;
  process.env.CREWAI_RUNNER_URL = deployed.url;
  return { cfg, dockerDeployed: true };
}
