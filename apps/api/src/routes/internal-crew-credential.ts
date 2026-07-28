import type { FastifyInstance } from 'fastify';
import { verifyCrewToolBridgeToken } from '../execution/crew-tool-bridge-token.js';
import {
  crewCredentialBridgeId,
  extractApiKeyFromCredentialData,
} from '../execution/crew-credential-bridge.js';

export interface InternalCrewCredentialRouteDeps {
  bridgeSecret: string;
  resolveCredentialData: (
    credentialRef: string,
  ) => Promise<Record<string, string>>;
}

export async function registerInternalCrewCredentialRoutes(
  app: FastifyInstance,
  deps: InternalCrewCredentialRouteDeps,
): Promise<void> {
  app.post<{ Params: { credentialRef: string } }>(
    '/internal/crew-credential/:credentialRef',
    async (req, reply) => {
      const credentialRef = req.params.credentialRef.trim();
      if (!credentialRef) {
        return reply.status(400).send({ code: 'E1045' });
      }

      const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      const executionId = String(req.headers['x-rxwf-execution-id'] ?? '');
      const bridgeId = crewCredentialBridgeId(credentialRef);
      if (
        !verifyCrewToolBridgeToken(
          deps.bridgeSecret,
          auth,
          executionId,
          bridgeId,
        )
      ) {
        return reply.status(401).send({ code: 'E1045' });
      }

      let data: Record<string, string>;
      try {
        data = await deps.resolveCredentialData(credentialRef);
      } catch {
        return reply.status(404).send({ code: 'E1045' });
      }

      const apiKey = extractApiKeyFromCredentialData(data);
      if (!apiKey) {
        return reply.status(404).send({ code: 'E1045' });
      }

      return { apiKey };
    },
  );
}
