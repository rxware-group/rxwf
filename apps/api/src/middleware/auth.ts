import type { AuthService } from "@rxwf/identity";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth?: import("@rxwf/identity").AuthContext;
  }
}

export function createAuthPreHandler(authService: AuthService) {
  return async function authPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const headers = authService.parseRequestHeaders(request.headers);
    const ctx = await authService.authenticate(headers);
    if (!ctx) {
      await reply.status(401).send({ error: "Unauthorized" });
      return;
    }
    request.auth = ctx;
  };
}
