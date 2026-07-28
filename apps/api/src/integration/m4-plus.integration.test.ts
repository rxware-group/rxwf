/**
 * M4 v1.0-plus 集成测试：Chat SSE、Admin i18n、插件签名校验
 *
 * MCP 实时连接测试需 `RXWF_TEST_MCP=1`（需 Docker / npx 可用）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { createTestDb } from '@rxwf/providers-lite';
import { createAuthService, createUserService } from '@rxwf/identity';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { buildApp } from '../app.js';
import { config } from '../config.js';

function signManifest(body: string): string {
  return createHmac('sha256', config.pluginSigningSecret).update(body).digest('hex');
}

const runMcpLive = process.env.RXWF_TEST_MCP === '1';

describe('M4 plus integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let apiKey: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
      featurePlus: true,
      aiRuntime: {
        async *chat() {
          yield 'mock-assistant';
        },
      },
    });
    app = built.app;
    const users = createUserService(db);
    const auth = createAuthService(db);
    const admin = await users.createUser({
      email: 'plus@example.com',
      password: 'secret',
      role: 'admin',
    });
    apiKey = (await auth.createApiKey(admin.id, 'plus')).key;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const headers = () => ({ 'x-api-key': apiKey });

  it('creates chat session and streams SSE tokens (AC-18)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      headers: headers(),
      payload: { title: 'M4 Chat' },
    });
    expect(createRes.statusCode).toBe(201);
    const session = createRes.json() as { id: string };

    const streamRes = await app.inject({
      method: 'POST',
      url: `/api/chat/sessions/${session.id}/stream`,
      headers: headers(),
      payload: { content: 'hello' },
    });
    expect(streamRes.statusCode).toBe(200);
    expect(streamRes.body).toContain('mock-assistant');
    expect(streamRes.body).toContain('[DONE]');
  });

  it('admin can override i18n bundle (AC-40)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/i18n/zh-CN',
      headers: headers(),
      payload: { messages: { 'nav.workflows': '自定义工作流' } },
    });
    expect(res.statusCode).toBe(200);
    expect(getLocaleBundle('zh-CN')['nav.workflows']).toBe('自定义工作流');
  });

  it('rejects plugin with bad signature (AC-27)', async () => {
    const manifest = JSON.stringify({ type: 'badPlugin', version: 1, handler: 'echo' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/plugins/register',
      headers: headers(),
      payload: { manifest, signature: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'E3020' });
  });

  it('registers plugin with valid signature (AC-26)', async () => {
    const manifest = JSON.stringify({ type: 'goodPlugin', version: 1, handler: 'echo' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/plugins/register',
      headers: headers(),
      payload: { manifest, signature: signManifest(manifest) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, type: 'goodPlugin' });
  });

  it('lists and toggles plugins (AC-26)', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/plugins',
      headers: headers(),
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { plugins: Array<{ id: string; type: string }> };
    expect(list.plugins.some((p) => p.type === 'goodPlugin')).toBe(true);
    const pluginId = list.plugins.find((p) => p.type === 'goodPlugin')!.id;
    const disableRes = await app.inject({
      method: 'POST',
      url: `/api/plugins/${pluginId}/disable`,
      headers: headers(),
    });
    expect(disableRes.statusCode).toBe(200);
  });

  it('creates npx mcp server record', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'FS MCP',
        transport: 'npx',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      },
    });
    expect(createRes.statusCode).toBe(201);
  });

  it.skipIf(!runMcpLive)('tests npx mcp connection and lists tools', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'FS MCP Live',
        transport: 'npx',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };
    const testRes = await app.inject({
      method: 'POST',
      url: `/api/mcp-servers/${created.id}/test`,
      headers: headers(),
    });
    expect(testRes.statusCode).toBe(200);
    const toolsRes = await app.inject({
      method: 'GET',
      url: `/api/mcp-servers/${created.id}/tools`,
      headers: headers(),
    });
    expect(toolsRes.statusCode).toBe(200);
    expect((toolsRes.json() as { tools: string[] }).tools.length).toBeGreaterThan(0);
  }, 120_000);

  it('registers docker mcp server config', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'Docker MCP',
        transport: 'docker',
        docker: {
          image: 'mcp/filesystem:latest',
          args: ['--stdio'],
          volumes: ['/data:/data:ro'],
          env: { TOKEN: 'x' },
          network: 'bridge',
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string; transport: string; docker: { image: string } };
    expect(created.transport).toBe('docker');
    expect(created.docker.image).toBe('mcp/filesystem:latest');

    const badRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'Bad Docker',
        transport: 'docker',
        docker: { image: 'x', volumes: ['/var/run/docker.sock:/sock'] },
      },
    });
    expect(badRes.statusCode).toBe(400);
  });

  it.skipIf(!runMcpLive)('tests docker mcp connection', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'Docker MCP Live',
        transport: 'docker',
        docker: {
          image: 'mcp/filesystem:latest',
          args: ['--stdio'],
          volumes: ['/data:/data:ro'],
          env: { TOKEN: 'x' },
          network: 'bridge',
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };

    const testRes = await app.inject({
      method: 'POST',
      url: `/api/mcp-servers/${created.id}/test`,
      headers: headers(),
    });
    expect(testRes.statusCode).toBe(200);
  }, 120_000);

  it('registers docker gateway mcp server without image', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'MCP_DOCKER',
        transport: 'docker',
        command: 'docker',
        args: ['mcp', 'gateway', 'run', '--profile', 'default'],
        docker: {
          env: {
            LOCALAPPDATA: 'C:\\Users\\zdw-m\\AppData\\Local',
            ProgramData: 'C:\\ProgramData',
          },
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      id: string;
      command: string;
      args: string[];
      docker?: { env?: Record<string, string> };
    };
    expect(created.command).toBe('docker');
    expect(created.args).toContain('mcp');
    expect(created.docker?.env?.LOCALAPPDATA).toContain('AppData');
  });

  it.skipIf(!runMcpLive)('tests docker gateway mcp connection', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/mcp-servers',
      headers: headers(),
      payload: {
        name: 'MCP_DOCKER Live',
        transport: 'docker',
        command: 'docker',
        args: ['mcp', 'gateway', 'run', '--profile', 'default'],
        docker: {
          env: {
            LOCALAPPDATA: 'C:\\Users\\zdw-m\\AppData\\Local',
            ProgramData: 'C:\\ProgramData',
          },
        },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string };

    const testRes = await app.inject({
      method: 'POST',
      url: `/api/mcp-servers/${created.id}/test`,
      headers: headers(),
    });
    expect(testRes.statusCode).toBe(200);
  }, 120_000);
});
