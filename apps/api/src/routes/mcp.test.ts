import { describe, it, expect } from 'vitest';
import { createTestDb, createLiteWorkflowRepository } from '@rxwf/providers-lite';
import { createWorkflowService } from '@rxwf/workflow';
import { createAuthService, createUserService } from '@rxwf/identity';
import { buildApp } from '../app.js';
import { eq } from 'drizzle-orm';
import { liteSchema } from '@rxwf/providers-lite';

describe('MCP HTTP tools AC-13', () => {
  it('creates workflow and executes via MCP tool call', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'mcp@example.com',
      password: 'secret',
      role: 'admin',
    });
    const { key } = await auth.createApiKey(user.id, 'mcp');

    const createRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: { 'x-api-key': key },
      payload: {
        name: 'workflow_create',
        arguments: {
          name: 'MCP HTTP',
          definition: {
            schemaVersion: 1,
            name: 'MCP HTTP',
            nodes: [
              {
                id: 't1',
                type: 'manualTrigger',
                name: 'T',
                position: { x: 0, y: 0 },
                parameters: {},
              },
            ],
            connections: [],
          },
        },
      },
    });
    expect(createRes.statusCode).toBe(200);
    const { id } = JSON.parse(
      (createRes.json() as { content: { text: string }[] }).content[0].text,
    ) as { id: string };

    const workflows = createWorkflowService(createLiteWorkflowRepository(db));
    await workflows.update(id, {
      schemaVersion: 1,
      name: 'MCP HTTP',
      active: true,
      nodes: [
        {
          id: 't1',
          type: 'manualTrigger',
          name: 'T',
          position: { x: 0, y: 0 },
          parameters: {},
        },
      ],
      connections: [],
    });

    const execRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: { 'x-api-key': key },
      payload: { name: 'workflow_execute', arguments: { workflowId: id } },
    });
    expect(execRes.statusCode).toBe(200);
    const execBody = JSON.parse(
      (execRes.json() as { content: { text: string }[] }).content[0].text,
    ) as { status: string };
    expect(execBody.status).toBe('success');
    await app.close();
  });

  it('runner_list and runner_create_registration_token via MCP', async () => {
    const db = await createTestDb();
    const { app } = await buildApp({
      db,
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const users = createUserService(db);
    const auth = createAuthService(db);
    const user = await users.createUser({
      email: 'mcp-runner@example.com',
      password: 'secret',
      role: 'admin',
    });
    const { key } = await auth.createApiKey(user.id, 'mcp-runner');

    const listRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: { 'x-api-key': key },
      payload: { name: 'runner_list', arguments: {} },
    });
    expect(listRes.statusCode).toBe(200);
    const runners = JSON.parse(
      (listRes.json() as { content: { text: string }[] }).content[0].text,
    ) as Array<{ kind: string }>;
    expect(runners.some((r) => r.kind === 'embedded')).toBe(true);

    const tokenRes = await app.inject({
      method: 'POST',
      url: '/mcp/tools/call',
      headers: { 'x-api-key': key },
      payload: {
        name: 'runner_create_registration_token',
        arguments: { expiresInHours: 24, labels: ['ci'] },
      },
    });
    expect(tokenRes.statusCode).toBe(200);
    const tokenBody = JSON.parse(
      (tokenRes.json() as { content: { text: string }[] }).content[0].text,
    ) as { registrationToken: string; expiresAt: string };
    expect(tokenBody.registrationToken.length).toBeGreaterThan(10);
    expect(tokenBody.expiresAt).toBeTruthy();

    await app.close();
  });
});
