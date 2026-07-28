export type RuntimeMode = "lite" | "standard";

export interface StartArgs {
  mode?: RuntimeMode;
  postgresUrl?: string;
  redisUrl?: string;
  sqlitePath?: string;
  noDockerAuto?: boolean;
  autoPort?: boolean;
  withWeb?: boolean;
  withCrewai?: boolean;
  crewaiUrl?: string;
  depsLifecycle?: "keep" | "down";
  startupTimeoutSec?: number;
  dockerComposeFile?: string;
}

export interface RuntimeBootstrapConfig {
  mode: RuntimeMode;
  deployProfile: RuntimeMode;
  postgresUrl?: string;
  redisUrl?: string;
  sqlitePath: string;
  noDockerAuto: boolean;
  autoPort: boolean;
  withWeb: boolean;
  withCrewai: boolean;
  crewaiUrl?: string;
  crewaiRunnerUrl?: string;
  crewaiPortBinding: string;
  crewaiOverlayFile: string;
  crewaiImage?: string;
  depsLifecycle: "keep" | "down";
  startupTimeoutSec: number;
  dockerComposeFile: string;
}

export interface DepPlan {
  needRedis: boolean;
  needPostgres: boolean;
}
