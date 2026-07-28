import type { McpDockerConfig, McpServerRecord, McpTransport } from './store.js';

export type McpLaunchSpec = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

const DOCKER_SOCK_PATTERN = /docker\.sock/i;
const PRIVILEGED_PATTERN = /^--privileged$/i;

function rejectPrivilegedArgs(args: string[] | undefined): void {
  for (const arg of args ?? []) {
    if (PRIVILEGED_PATTERN.test(arg.trim())) {
      throw new Error('--privileged is not allowed');
    }
  }
}

export function validateDockerVolume(volume: string): void {
  const trimmed = volume.trim();
  if (!trimmed) {
    throw new Error('empty volume mount');
  }
  if (DOCKER_SOCK_PATTERN.test(trimmed)) {
    throw new Error('mounting docker.sock is not allowed');
  }
}

/** 校验 docker 配置：镜像模式需 image；Gateway/CLI 模式需 args。 */
export function validateDockerConfig(docker: McpDockerConfig): void {
  rejectPrivilegedArgs(docker.args);
  for (const vol of docker.volumes ?? []) {
    validateDockerVolume(vol);
  }
  const image = docker.image?.trim();
  if (image) return;
  const args = docker.args ?? [];
  if (args.length === 0) {
    throw new Error('docker.args or docker.image is required');
  }
}

export function dockerHasRunImage(docker?: McpDockerConfig): boolean {
  return !!docker?.image?.trim();
}

export function dockerHasCliArgs(
  server: Pick<McpServerRecord, 'args' | 'docker'>,
): boolean {
  const args = server.args ?? server.docker?.args ?? [];
  return args.length > 0;
}

export function validateDockerTransport(
  server: Pick<McpServerRecord, 'command' | 'args' | 'docker'>,
): void {
  if (dockerHasRunImage(server.docker)) {
    validateDockerConfig(server.docker!);
    return;
  }
  if (!dockerHasCliArgs(server)) {
    throw new Error('docker requires image or args (e.g. mcp gateway run)');
  }
  rejectPrivilegedArgs(server.args);
  rejectPrivilegedArgs(server.docker?.args);
  for (const vol of server.docker?.volumes ?? []) {
    validateDockerVolume(vol);
  }
}

/** 将 docker 配置转为 `docker run -i --rm ...` 参数（不含 `docker` 命令本身）。 */
export function buildDockerRunArgs(docker: McpDockerConfig & { image: string }): string[] {
  rejectPrivilegedArgs(docker.args);
  for (const vol of docker.volumes ?? []) {
    validateDockerVolume(vol);
  }
  const args = ['run', '-i', '--rm'];
  const network = docker.network?.trim();
  if (network) {
    args.push('--network', network);
  }
  for (const [key, value] of Object.entries(docker.env ?? {})) {
    args.push('-e', `${key}=${value}`);
  }
  for (const vol of docker.volumes ?? []) {
    args.push('-v', vol.trim());
  }
  args.push(docker.image.trim());
  if (docker.args?.length) {
    args.push(...docker.args);
  }
  return args;
}

export function buildLaunchFromServer(
  server: Pick<McpServerRecord, 'transport' | 'command' | 'args' | 'url' | 'docker'>,
): McpLaunchSpec | undefined {
  if (server.transport === 'npx') {
    return {
      command: server.command ?? 'npx',
      args: server.args ?? ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    };
  }
  if (server.transport === 'docker') {
    const docker = server.docker;
    const image = docker?.image?.trim();
    if (image) {
      return {
        command: 'docker',
        args: buildDockerRunArgs({ ...docker, image }),
      };
    }
    const args = server.args ?? docker?.args;
    if (!args?.length) return undefined;
    const env = docker?.env;
    return {
      command: server.command?.trim() || 'docker',
      args,
      ...(env && Object.keys(env).length > 0 ? { env } : {}),
    };
  }
  if (server.transport === 'http' && server.url) {
    return { command: 'npx', args: ['-y', 'rxwf-mcp-http-stub', server.url] };
  }
  return undefined;
}

export function parseEnvLines(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

export function formatEnvLines(env: Record<string, string> | undefined): string {
  if (!env || Object.keys(env).length === 0) return '';
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

export function parseVolumeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function formatVolumeLines(volumes: string[] | undefined): string {
  return volumes?.join('\n') ?? '';
}

export const MCP_TRANSPORTS: McpTransport[] = ['npx', 'docker', 'http'];
