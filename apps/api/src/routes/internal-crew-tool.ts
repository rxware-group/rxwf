import type { FastifyInstance } from 'fastify';
import { verifyCrewToolBridgeToken } from '../execution/crew-tool-bridge-token.js';
import type { InvokeCrewToolFn } from '../execution/crew-tool-bridge-types.js';

export interface InternalCrewToolRouteDeps {
  invokeCrewTool: InvokeCrewToolFn;
  bridgeSecret: string;
}

export async function registerInternalCrewToolRoutes(
  app: FastifyInstance,
  deps: InternalCrewToolRouteDeps,
): Promise<void> {
  app.post<{ Params: { bridgeId: string }; Body: Record<string, unknown> }>(
    '/internal/crew-tool/:bridgeId',
    async (req, reply) => {
      const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      const executionId = String(req.headers['x-rxwf-execution-id'] ?? '');
      if (
        !verifyCrewToolBridgeToken(deps.bridgeSecret, auth, executionId, req.params.bridgeId)
      ) {
        return reply.status(401).send({ code: 'E1045' });
      }
      const out = await deps.invokeCrewTool(
        req.params.bridgeId,
        req.body ?? {},
        { executionId },
      );
      return { result: out };
    },
  );
}
