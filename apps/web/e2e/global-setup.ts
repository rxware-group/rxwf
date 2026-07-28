import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmdUp } from '../../../scripts/e2e-compose.mjs';

export type E2eTrack = 'standard' | 'plus' | 'lite';

const defaultE2eDir = path.dirname(fileURLToPath(import.meta.url));

type CmdUpFn = (
  track: string,
  options?: Record<string, unknown>,
) => Promise<number>;

export function resolveE2eTrack(env: NodeJS.ProcessEnv = process.env): E2eTrack {
  const raw = env.RXWF_E2E_TRACK?.trim().toLowerCase();
  if (raw === 'standard' || raw === 'plus') {
    return raw;
  }
  return 'lite';
}

export function ensureComposeEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...env,
    RXWF_POSTGRES_USER: env.RXWF_POSTGRES_USER ?? 'rxwf',
    RXWF_POSTGRES_PASSWORD: env.RXWF_POSTGRES_PASSWORD ?? 'e2e-test-pass',
    RXWF_POSTGRES_DB: env.RXWF_POSTGRES_DB ?? 'rxwf',
    RXWF_REDIS_PASSWORD: env.RXWF_REDIS_PASSWORD ?? 'e2e-test-pass',
  };
}

function resolveCrewAiPort(env: NodeJS.ProcessEnv): string {
  const raw = env.RXWF_CREWAI_PORT?.trim();
  if (!raw) {
    return '8071';
  }
  const hostPort = raw.split(':').at(-1);
  return hostPort && /^\d+$/.test(hostPort) ? hostPort : '8071';
}

export function buildE2eEnvLines(
  track: E2eTrack,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const composeEnv = ensureComposeEnv(env);
  const apiPort = composeEnv.RXWF_E2E_API_PORT ?? '9878';
  const webPort = composeEnv.RXWF_E2E_WEB_PORT ?? '9323';
  const lines = [
    `RXWF_E2E_TRACK=${track}`,
    `RXWF_E2E_API_PORT=${apiPort}`,
    `RXWF_E2E_WEB_PORT=${webPort}`,
  ];

  if (track === 'standard' || track === 'plus') {
    const pgUser = composeEnv.RXWF_POSTGRES_USER ?? 'rxwf';
    const pgPassword = composeEnv.RXWF_POSTGRES_PASSWORD ?? 'e2e-test-pass';
    const pgDb = composeEnv.RXWF_POSTGRES_DB ?? 'rxwf';
    const redisPassword = composeEnv.RXWF_REDIS_PASSWORD ?? 'e2e-test-pass';

    lines.push(
      `RXWF_DATABASE_URL=postgres://${pgUser}:${encodeURIComponent(pgPassword)}@127.0.0.1:5432/${pgDb}`,
      `RXWF_REDIS_URL=redis://:${encodeURIComponent(redisPassword)}@127.0.0.1:6379/0`,
    );
  }

  if (track === 'plus') {
    lines.push(`CREWAI_RUNNER_URL=http://127.0.0.1:${resolveCrewAiPort(composeEnv)}`);
  }

  return lines;
}

export function formatE2eEnv(
  track: E2eTrack,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return `${buildE2eEnvLines(track, env).join('\n')}\n`;
}

export async function runGlobalSetup(options: {
  e2eDir?: string;
  env?: NodeJS.ProcessEnv;
  cmdUpFn?: CmdUpFn;
  rmFn?: typeof rm;
  writeFileFn?: typeof writeFile;
} = {}): Promise<void> {
  const e2eDir = options.e2eDir ?? defaultE2eDir;
  const env = options.env ?? process.env;
  const cmdUpFn = options.cmdUpFn ?? cmdUp;
  const rmFn = options.rmFn ?? rm;
  const writeFileFn = options.writeFileFn ?? writeFile;
  const authDir = path.join(e2eDir, '.auth');
  const e2eEnvPath = path.join(e2eDir, '.e2e-env');
  const track = resolveE2eTrack(env);

  await rmFn(authDir, { recursive: true, force: true });

  if (track === 'standard' || track === 'plus') {
    const composeEnv = ensureComposeEnv(env);
    Object.assign(process.env, composeEnv);
    await cmdUpFn(track);
  }

  await writeFileFn(e2eEnvPath, formatE2eEnv(track, env), 'utf8');
}

export default async function globalSetup(): Promise<void> {
  await runGlobalSetup();
}
