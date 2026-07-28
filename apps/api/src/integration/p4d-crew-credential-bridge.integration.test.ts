/**
 * P4-D crew credential bridge internal route
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { createCrewToolBridgeToken } from '../execution/crew-tool-bridge-token.js';
import { registerInternalCrewCredentialRoutes } from '../routes/internal-crew-credential.js';

const BRIDGE_SECRET = 'p4d-crew-credential-bridge-test-secret';
const EXECUTION_ID = 'exec-p4d-cred-1';
const CREDENTIAL_REF = 'cred-openai-1';
const CREDENTIAL_BRIDGE_ID = `credential:${CREDENTIAL_REF}`;

describe('P4-D crew credential bridge integration', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerInternalCrewCredentialRoutes(app, {
      bridgeSecret: BRIDGE_SECRET,
      resolveCredentialData: async (ref) => {
        if (ref !== CREDENTIAL_REF) throw new Error('not found');
        return { apiKey: 'sk-test-key' };
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function validToken(): string {
    return createCrewToolBridgeToken({
      secret: BRIDGE_SECRET,
      executionId: EXECUTION_ID,
      bridgeId: CREDENTIAL_BRIDGE_ID,
      expiresAtMs: Date.now() + 60_000,
    });
  }

  it('returns apiKey with valid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/internal/crew-credential/${CREDENTIAL_REF}`,
      headers: {
        authorization: `Bearer ${validToken()}`,
        'x-rxwf-execution-id': EXECUTION_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ apiKey: 'sk-test-key' });
  });

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/internal/crew-credential/${CREDENTIAL_REF}`,
      headers: {
        authorization: 'Bearer invalid-token',
        'x-rxwf-execution-id': EXECUTION_ID,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ code: 'E1045' });
  });
});
