import { createUserService } from '@rxwf/identity';
import { AwfError } from '@rxwf/shared';
import type { LiteDatabase } from '@rxwf/providers-lite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export function registerUserProfileRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const userService = createUserService(db);

  app.patch(
    '/api/users/me/profile',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        nickname?: string;
        avatarUrl?: string | null;
      };

      try {
        const row = await userService.updateProfile(request.auth!.userId, body);
        return {
          email: row.email,
          role: row.role,
          mustChangePassword: row.mustChangePassword,
          nickname: row.nickname,
          avatarUrl: row.avatarUrl,
        };
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({
          code: 'E5000',
          message: err instanceof Error ? err.message : 'Profile update failed',
        });
      }
    },
  );
}
