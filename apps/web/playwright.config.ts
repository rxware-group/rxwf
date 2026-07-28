import { defineConfig, devices, type Project } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_TRACKS = ['lite', 'standard', 'plus'] as const;
export type E2eTrack = (typeof E2E_TRACKS)[number];

const REQUIRED_DUAL_TRACKS = ['standard', 'plus'] as const;

export function resolveE2eTrack(raw?: string): E2eTrack {
  const track = (raw ?? process.env.RXWF_E2E_TRACK ?? 'lite').trim().toLowerCase();
  if (!E2E_TRACKS.includes(track as E2eTrack)) {
    throw new Error(
      `Unknown RXWF_E2E_TRACK "${raw ?? process.env.RXWF_E2E_TRACK}". Expected lite, standard, or plus.`,
    );
  }
  return track as E2eTrack;
}

export function assertRequiredTrackProjects(
  projects: ReadonlyArray<Pick<Project, 'name'>>,
): void {
  const names = new Set(projects.map((project) => project.name));
  for (const track of REQUIRED_DUAL_TRACKS) {
    if (!names.has(`${track}-chromium`)) {
      throw new Error(`Missing ${track} project definition`);
    }
  }
}

export type BuildE2eProjectsOptions = {
  e2eDir: string;
  trackFilter?: E2eTrack;
};

export function buildE2eProjects(options: BuildE2eProjectsOptions): Project[] {
  const tracks = options.trackFilter ? [options.trackFilter] : [...E2E_TRACKS];
  const storageState = path.join(options.e2eDir, '.auth', 'user.json');

  return tracks.flatMap((track) => [
    {
      name: `${track}-setup`,
      testMatch: /auth\.setup\.ts/,
      metadata: { track },
    },
    {
      name: `${track}-chromium`,
      dependencies: [`${track}-setup`],
      metadata: { track },
      grep: track === 'standard' ? /@standard|@any/ : track === 'plus' ? /@plus|@any/ : undefined,
      grepInvert: track === 'lite' ? /@standard|@plus/ : undefined,
      use: {
        ...devices['Desktop Chrome'],
        storageState,
      },
    },
  ]);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const e2eDir = path.join(__dirname, 'e2e');
const e2eApiPort = Number(process.env.RXWF_E2E_API_PORT ?? 9878);
const e2eWebPort = Number(process.env.RXWF_E2E_WEB_PORT ?? 9323);
const e2eDataDir =
  process.env.RXWF_E2E_DATA_DIR ??
  path.join(os.tmpdir(), 'rxwf-e2e', `run-${Date.now()}`);
mkdirSync(e2eDataDir, { recursive: true });
writeFileSync(path.join(e2eDir, '.data-dir'), e2eDataDir, 'utf8');

const activeTrack = process.env.RXWF_E2E_TRACK?.trim();
const trackFilter = activeTrack ? resolveE2eTrack(activeTrack) : undefined;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/*.test.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${e2eWebPort}`,
    trace: 'on-first-retry',
  },
  projects: buildE2eProjects({ e2eDir, trackFilter }),
  webServer: [
    {
      command: 'pnpm --filter @rxwf/api run dev',
      url: `http://127.0.0.1:${e2eApiPort}/api/health`,
      cwd: repoRoot,
      env: {
        RXWF_DATA_DIR: e2eDataDir,
        RXWF_HTTP_PORT: String(e2eApiPort),
        RXWF_SEED_KNOWLEDGE_PLATFORM: '1',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @rxwf/web exec vite --host 127.0.0.1 --port ${e2eWebPort} --strictPort`,
      url: `http://127.0.0.1:${e2eWebPort}`,
      cwd: repoRoot,
      env: {
        RXWF_API_PROXY_TARGET: `http://127.0.0.1:${e2eApiPort}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
