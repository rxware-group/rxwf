import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..');
export const COMPOSE_PROJECT = 'rxwf-e2e';

export const TRACK_COMPOSE_FILES = {
  standard: join(REPO_ROOT, 'deploy', 'docker-compose.standard.yml'),
  plus: join(REPO_ROOT, 'deploy', 'docker-compose.plus.yml'),
};

const DEFAULT_HEALTH_TIMEOUT_MS = 120_000;
const DEFAULT_HEALTH_INTERVAL_MS = 2_000;

/**
 * @param {string} track
 * @returns {string}
 */
export function resolveTrack(track) {
  const key = track?.trim().toLowerCase();
  const composeFile = TRACK_COMPOSE_FILES[key];
  if (!composeFile) {
    throw new Error(`Unknown track "${track}". Expected standard or plus.`);
  }
  return composeFile;
}

/**
 * @param {string} stdout
 * @returns {Array<{ Service?: string; Health?: string; State?: string }>}
 */
export function parsePsJson(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * @param {Array<{ Service?: string; Health?: string; State?: string }>} rows
 */
export function allServicesHealthy(rows) {
  const running = rows.filter((row) => row.State === 'running');
  if (running.length === 0) {
    return false;
  }
  return running.every((row) => {
    const health = row.Health?.trim();
    if (!health) {
      return true;
    }
    return health === 'healthy';
  });
}

/**
 * @param {string} composeFile
 * @param {string[]} args
 * @param {{
 *   env?: NodeJS.ProcessEnv;
 *   project?: string;
 *   dryRun?: boolean;
 *   execFn?: typeof defaultExecCompose;
 *   log?: (message: string) => void;
 * }} [options]
 */
export async function execCompose(composeFile, args, options = {}) {
  const {
    env = process.env,
    project = COMPOSE_PROJECT,
    dryRun = false,
    execFn = defaultExecCompose,
    log = () => {},
  } = options;

  const cmd = [
    'docker',
    'compose',
    '-f',
    composeFile,
    '-p',
    project,
    ...args,
  ].join(' ');

  if (dryRun) {
    log(cmd);
    return '';
  }

  return execFn(composeFile, args, { env, project });
}

/**
 * @param {string} composeFile
 * @param {string[]} args
 * @param {{ env: NodeJS.ProcessEnv; project: string }} context
 */
async function defaultExecCompose(composeFile, args, { env, project }) {
  const { stdout } = await execFileAsync(
    'docker',
    ['compose', '-f', composeFile, '-p', project, ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout.toString();
}

/**
 * @param {{
 *   composeFile: string;
 *   project?: string;
 *   timeoutMs?: number;
 *   intervalMs?: number;
 *   execFn?: typeof defaultExecCompose;
 *   now?: () => number;
 *   sleep?: (ms: number) => Promise<void>;
 * }} options
 */
export async function waitForHealth(options) {
  const {
    composeFile,
    project = COMPOSE_PROJECT,
    timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
    intervalMs = DEFAULT_HEALTH_INTERVAL_MS,
    execFn = defaultExecCompose,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  const started = now();

  while (now() - started < timeoutMs) {
    const stdout = await execFn(composeFile, ['ps', '--format', 'json'], {
      env: process.env,
      project,
    });
    const rows = parsePsJson(stdout);
    if (allServicesHealthy(rows)) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `Healthcheck timeout after ${timeoutMs}ms for project ${project}.`,
  );
}

/**
 * @param {{
 *   composeFile: string;
 *   project?: string;
 *   execFn?: typeof defaultExecCompose;
 * }} options
 */
export async function assertNoContainers(options) {
  const {
    composeFile,
    project = COMPOSE_PROJECT,
    execFn = defaultExecCompose,
  } = options;

  const stdout = await execFn(composeFile, ['ps', '-q'], {
    env: process.env,
    project,
  });
  const ids = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    throw new Error(
      `Containers still exist after down for project ${project}: ${ids.join(', ')}`,
    );
  }
}

/**
 * @param {string} track
 * @param {{
 *   dryRun?: boolean;
 *   noWait?: boolean;
 *   timeoutMs?: number;
 *   execFn?: typeof defaultExecCompose;
 *   log?: (message: string) => void;
 * }} [options]
 */
export async function cmdUp(track, options = {}) {
  const {
    dryRun = false,
    noWait = false,
    timeoutMs,
    execFn = defaultExecCompose,
    log = (message) => process.stdout.write(`${message}\n`),
  } = options;

  const composeFile = resolveTrack(track);
  await execCompose(composeFile, ['up', '-d'], {
    dryRun,
    execFn,
    log,
  });

  if (!dryRun && !noWait) {
    await waitForHealth({ composeFile, timeoutMs, execFn });
  }

  return 0;
}

/**
 * @param {string} track
 * @param {{
 *   dryRun?: boolean;
 *   execFn?: typeof defaultExecCompose;
 *   log?: (message: string) => void;
 * }} [options]
 */
export async function cmdDown(track, options = {}) {
  const {
    dryRun = false,
    execFn = defaultExecCompose,
    log = (message) => process.stdout.write(`${message}\n`),
  } = options;

  const composeFile = resolveTrack(track);
  await execCompose(composeFile, ['down', '-v'], {
    dryRun,
    execFn,
    log,
  });

  if (!dryRun) {
    await assertNoContainers({ composeFile, execFn });
  }

  return 0;
}

/**
 * @param {string} track
 * @param {{
 *   timeoutMs?: number;
 *   execFn?: typeof defaultExecCompose;
 * }} [options]
 */
export async function cmdWaitHealth(track, options = {}) {
  const composeFile = resolveTrack(track);
  await waitForHealth({
    composeFile,
    timeoutMs: options.timeoutMs,
    execFn: options.execFn,
  });
  return 0;
}

/**
 * @param {string[]} argv
 */
export function parseCli(argv) {
  const args = [...argv];
  const flags = {
    dryRun: false,
    noWait: false,
    timeoutMs: undefined,
  };

  const takeValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) {
      return undefined;
    }
    const value = args[index + 1];
    args.splice(index, 2);
    return value;
  };

  if (args.includes('--dry-run')) {
    flags.dryRun = true;
    args.splice(args.indexOf('--dry-run'), 1);
  }
  if (args.includes('--no-wait')) {
    flags.noWait = true;
    args.splice(args.indexOf('--no-wait'), 1);
  }

  const timeoutSec = takeValue('--timeout');
  if (timeoutSec !== undefined) {
    flags.timeoutMs = Number(timeoutSec) * 1000;
  }

  const [command, track] = args;
  return { command, track, flags };
}

/**
 * @param {string[]} argv
 */
export async function main(argv = process.argv.slice(2)) {
  const { command, track, flags } = parseCli(argv);

  if (!command || !track) {
    throw new Error(
      'Usage: node scripts/e2e-compose.mjs <up|down|wait-health> <standard|plus> [--dry-run] [--no-wait] [--timeout <sec>]',
    );
  }

  switch (command) {
    case 'up':
      return cmdUp(track, {
        dryRun: flags.dryRun,
        noWait: flags.noWait,
        timeoutMs: flags.timeoutMs,
      });
    case 'down':
      return cmdDown(track, { dryRun: flags.dryRun });
    case 'wait-health':
      return cmdWaitHealth(track, { timeoutMs: flags.timeoutMs });
    default:
      throw new Error(`Unknown command "${command}".`);
  }
}

const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main()
    .then((code) => {
      if (typeof code === 'number' && code !== 0) {
        process.exitCode = code;
      }
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
