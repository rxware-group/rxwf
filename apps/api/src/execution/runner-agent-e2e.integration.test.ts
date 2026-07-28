/**
 * Spawn real `rxwf-runner start` and run code + executeCommand with pinned policy.
 * Run with:
 *   pnpm --filter @rxwf/runner-agent build
 *   RXWF_TEST_RUNNER_AGENT=1 pnpm --filter @rxwf/api test -- runner-agent-e2e
 *
 * CI: `.github/workflows/nightly-runner-agent.yml` (daily + workflow_dispatch).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  createLiteWorkflowRepository,
  createTestDb,
  liteSchema,
} from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
import { runnerGateway } from '../runners/gateway-instance.js';

const nodeRunsTable = liteSchema.nodeRuns;

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const runnerCliPath = join(repoRoot, 'packages/runner-agent/dist/cli/main.js');

/** Set `RXWF_TEST_RUNNER_AGENT=1` (CI nightly) to spawn real `rxwf-runner start`. */
const runRunnerAgentE2e = process.env.RXWF_TEST_RUNNER_AGENT === '1';
const runnerCliBuilt = existsSync(runnerCliPath);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function adminKey(db: Awaited<ReturnType<typeof createTestDb>>) {
  const users = createUserService(db);
  const auth = createAuthService(db);
  const user = await users.createUser({
    email: `runner-e2e-${crypto.randomUUID()}@example.com`,
    password: 'secret',
    role: 'admin',
  });
  const { key } = await auth.createApiKey(user.id, 'runner-e2e');
  return key;
}

async function waitForRunnerOnline(
  runnerId: string,
  listRunners: () => Promise<Array<{ id: string; status: string }>>,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runnerGateway.isConnected(runnerId)) {
      return;
    }
    const runners = await listRunners();
    const row = runners.find((r) => r.id === runnerId);
    if (row?.status === 'online') {
      return;
    }
    await sleep(250);
  }
  throw new Error(`Runner ${runnerId} did not come online within ${timeoutMs}ms`);
}

function killRunnerProcess(child: ChildProcess | null): void {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }
  child.kill('SIGTERM');
}

describe.skipIf(!runRunnerAgentE2e || !runnerCliBuilt)('runner-agent e2e integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let apiKey: string;
  let port: number;
  let tempDir: string;
  let runnerChild: ChildProcess | null = null;
  let runnerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    app = built.app;
    apiKey = await adminKey(db);

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const serverUrl = `http://127.0.0.1:${port}`;

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/api/runners/registration-tokens',
      headers: { 'x-api-key': apiKey },
      payload: { labels: ['e2e'] },
    });
    expect(tokenRes.statusCode).toBe(201);
    const { registrationToken } = tokenRes.json() as {
      registrationToken: string;
    };

    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/runners/register',
      payload: {
        registrationToken,
        name: 'e2e-agent',
        platform: { os: 'linux', arch: 'x64' },
        capabilities: ['code', 'shell'],
        maxConcurrent: 4,
        agentVersion: '1.0.0',
      },
    });
    expect(registerRes.statusCode).toBe(201);
    const registered = registerRes.json() as {
      runnerId: string;
      runnerCredential: string;
    };
    runnerId = registered.runnerId;

    tempDir = await mkdtemp(join(tmpdir(), 'rxwf-runner-e2e-'));
    const credentialFile = join(tempDir, 'credential.json');
    const configPath = join(tempDir, 'rxwf-runner.json');

    await writeFile(
      credentialFile,
      `${JSON.stringify(
        {
          runnerId: registered.runnerId,
          runnerCredential: registered.runnerCredential,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await writeFile(
      configPath,
      `${JSON.stringify(
        {
          serverUrl,
          runnerId: registered.runnerId,
          credentialFile,
          name: 'e2e-agent',
          maxConcurrent: 4,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    runnerChild = spawn(
      process.execPath,
      [runnerCliPath, 'start', '--config', configPath],
      {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: repoRoot,
        env: { ...process.env },
      },
    );

    runnerChild.on('error', (err) => {
      console.error('[runner-agent-e2e] spawn error:', err);
    });

    await waitForRunnerOnline(runnerId, async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/runners',
        headers: { 'x-api-key': apiKey },
      });
      expect(listRes.statusCode).toBe(200);
      const body = listRes.json() as {
        runners: Array<{ id: string; status: string }>;
      };
      return body.runners;
    });
  }, 60_000);

  afterAll(async () => {
    killRunnerProcess(runnerChild);
    if (runnerChild) {
      await Promise.race([
        new Promise<void>((resolve) => {
          runnerChild!.once('exit', () => resolve());
        }),
        sleep(5_000).then(() => {
          killRunnerProcess(runnerChild);
        }),
      ]);
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    if (app) {
      await app.close();
    }
  });

  it(
    'runs code and executeCommand on spawned runner-agent with pinned policy',
    async () => {
      expect(runnerGateway.isConnected(runnerId)).toBe(true);

      const workflows = createWorkflowService(createLiteWorkflowRepository(db));
      const created = await workflows.create({
        name: 'Runner agent E2E',
        definition: {
          schemaVersion: 1,
          name: 'Runner agent E2E',
          active: true,
          settings: {
            runnerPolicy: {
              mode: 'pinned',
              runnerId,
              fallback: 'fail',
            },
          },
          nodes: [
            {
              id: 't1',
              type: 'manualTrigger',
              name: 'Start',
              position: { x: 0, y: 0 },
              parameters: {},
            },
            {
              id: 'code-1',
              type: 'code',
              name: 'Code',
              position: { x: 100, y: 0 },
              parameters: {
                jsCode: 'return [{ json: { fromCode: true } }];',
              },
            },
            {
              id: 'cmd-1',
              type: 'executeCommand',
              name: 'Run',
              position: { x: 200, y: 0 },
              parameters: { command: 'echo ok' },
            },
          ],
          connections: [
            { from: 't1', to: 'code-1' },
            { from: 'code-1', to: 'cmd-1' },
          ],
        },
      });

      const runRes = await app.inject({
        method: 'POST',
        url: `/api/workflows/${created.id}/executions`,
        headers: { 'x-api-key': apiKey },
        payload: { mode: 'manual' },
      });
      expect(runRes.statusCode).toBe(202);
      const { executionId, status } = runRes.json() as {
        executionId: string;
        status: string;
      };
      expect(status).toBe('success');

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/executions/${executionId}`,
        headers: { 'x-api-key': apiKey },
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = detailRes.json() as {
        status: string;
        nodeRuns: Array<{ nodeId: string; status: string; runnerId: string | null }>;
      };
      expect(detail.status).toBe('success');

      for (const nodeId of ['code-1', 'cmd-1']) {
        const rows = await db
          .select()
          .from(nodeRunsTable)
          .where(eq(nodeRunsTable.nodeId, nodeId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('success');
        expect(rows[0]?.runnerId).toBe(runnerId);
      }
    },
    60_000,
  );
});
