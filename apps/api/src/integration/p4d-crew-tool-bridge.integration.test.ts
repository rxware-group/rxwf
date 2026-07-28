/**
 * P4-D crew tool bridge internal route (mock invokeCrewTool)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import {
  createCrewToolBridgeToken,
} from '../execution/crew-tool-bridge-token.js';
import { registerInternalCrewToolRoutes } from '../routes/internal-crew-tool.js';

const BRIDGE_SECRET = 'p4d-crew-tool-bridge-test-secret';
const EXECUTION_ID = 'exec-p4d-bridge-1';
const BRIDGE_ID = 'bridge_agent_0';

describe('P4-D crew tool bridge integration', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerInternalCrewToolRoutes(app, {
      bridgeSecret: BRIDGE_SECRET,
      invokeCrewTool: async (bridgeId, args) => ({ bridgeId, args }),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function validToken(bridgeId = BRIDGE_ID): string {
    return createCrewToolBridgeToken({
      secret: BRIDGE_SECRET,
      executionId: EXECUTION_ID,
      bridgeId,
      expiresAtMs: Date.now() + 60_000,
    });
  }

  it('returns 200 with valid token and echoes bridgeId and args', async () => {
    const args = { query: 'hello', limit: 3 };
    const res = await app.inject({
      method: 'POST',
      url: `/internal/crew-tool/${BRIDGE_ID}`,
      headers: {
        authorization: `Bearer ${validToken()}`,
        'x-rxwf-execution-id': EXECUTION_ID,
        'content-type': 'application/json',
      },
      payload: args,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      result: { bridgeId: BRIDGE_ID, args },
    });
  });

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/internal/crew-tool/${BRIDGE_ID}`,
      headers: {
        authorization: 'Bearer invalid-token',
        'x-rxwf-execution-id': EXECUTION_ID,
        'content-type': 'application/json',
      },
      payload: { query: 'nope' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ code: 'E1045' });
  });
});
