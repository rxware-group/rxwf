export type RunnerOs = "windows" | "linux" | "macos";
export type RunnerArch = "x64" | "arm64" | "arm";

export interface RunnerPlatform {
  os: RunnerOs;
  arch: RunnerArch;
  osVersion?: string;
}

export interface RunnerRecord {
  id: string;
  name: string;
  kind: "embedded" | "agent";
  platform: RunnerPlatform;
  status: "online" | "offline" | "draining";
  capabilities: string[];
  maxConcurrent: number;
  runningJobs: number;
  labels?: string[];
  agentVersion?: string;
  lastHeartbeatAt?: Date;
}

export interface RunnerRegistrationInput {
  name: string;
  platform: RunnerPlatform;
  labels?: string[];
  capabilities: string[];
  maxConcurrent?: number;
  agentVersion?: string;
}

export interface RunnerRepositoryPort {
  ensureEmbedded(
    platform: RunnerPlatform,
    capabilities: string[],
  ): Promise<RunnerRecord>;
  listOnline(filter?: { kind?: string }): Promise<RunnerRecord[]>;
  listAll(): Promise<RunnerRecord[]>;
  findById(id: string): Promise<RunnerRecord | null>;
  incrementRunningJobs(id: string, delta: number): Promise<void>;
  registerAgent(input: RunnerRegistrationInput, credentialHash: string): Promise<RunnerRecord>;
  verifyCredential(runnerId: string, credential: string): Promise<boolean>;
  updatePresence(runnerId: string, runningJobs: number): Promise<void>;
  setStatus(runnerId: string, status: RunnerRecord['status']): Promise<void>;
  revokeAgent(runnerId: string): Promise<void>;
  rotateCredential(runnerId: string, newHash: string): Promise<void>;
}
