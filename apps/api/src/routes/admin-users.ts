import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LiteDatabase } from '@rxwf/providers-lite';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { createMailer } from '@rxwf/system-settings';
import {
  createAuthService,
  createInviteService,
  createUserAdminService,
  createUserService,
  type AdminUserRow,
} from '@rxwf/identity';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

function mapAdminUser(row: AdminUserRow) {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.role === 'admin',
    status: row.status,
    joinMethod: row.joinMethod,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

function awfErrorStatus(code: string): number {
  if (code === 'E1001') return 404;
  if (code === 'E1003') return 403;
  if (code === 'E5003') return 503;
  if (code === 'E4002' || code === 'E4003' || code === 'E1004') return 400;
  return 400;
}

function sendAwfError(reply: FastifyReply, err: unknown) {
  if (err instanceof AwfError) {
    return reply.status(awfErrorStatus(err.code)).send({ code: err.code, message: err.message });
  }
  throw err;
}

async function assertSmtpConfigured(
  getRuntimeConfig: () => Promise<RuntimeConfig>,
  reply: FastifyReply,
): Promise<RuntimeConfig | null> {
  const runtime = await getRuntimeConfig();
  if (!runtime.passwordResetEnabled) {
    await reply.status(503).send({ code: 'E5003', message: 'SMTP not configured' });
    return null;
  }
  return runtime;
}

export interface AdminUserRouteDeps {
  authPreHandler: ReturnType<typeof createAuthPreHandler>;
  getRuntimeConfig: () => Promise<RuntimeConfig>;
}

export function registerAdminUserRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  deps: AdminUserRouteDeps,
): void {
  const { authPreHandler, getRuntimeConfig } = deps;
  const users = createUserService(db);
  const invites = createInviteService(db);
  const userAdmin = createUserAdminService({ users, invites });
  const authService = createAuthService(db);

  const adminOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E1003', message: 'Admin required' });
    }
  };

  async function sendInviteEmail(opts: {
    to: string;
    inviteUrl: string;
    productName: string;
  }): Promise<void> {
    const runtime = await getRuntimeConfig();
    const mailer = createMailer(runtime.smtp);
    await mailer.send({
      to: opts.to,
      subject: `邀请您加入 ${opts.productName}`,
      text: `您好，\n请点击以下链接接受邀请（7 天内有效）：\n${opts.inviteUrl}\n如非本人操作，请忽略此邮件。`,
    });
  }

  app.get('/api/admin/users', { preHandler: adminOnly }, async (_request, reply) => {
    try {
      const rows = await userAdmin.list();
      return { users: rows.map(mapAdminUser) };
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.post('/api/admin/users/invite', { preHandler: adminOnly }, async (request, reply) => {
    const runtime = await assertSmtpConfigured(getRuntimeConfig, reply);
    if (!runtime) return;

    const body = (request.body ?? {}) as { email?: string; isAdmin?: boolean };
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) {
      return reply.status(400).send({ code: 'E1004', message: 'Valid email required' });
    }

    try {
      const { token } = await userAdmin.invite({
        email,
        isAdmin: Boolean(body.isAdmin),
        invitedByUserId: request.auth!.userId,
      });
      const inviteUrl = `${runtime.publicUrl.replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`;
      await sendInviteEmail({
        to: email,
        inviteUrl,
        productName: runtime.brand.productName,
      });
      return { ok: true };
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.post('/api/admin/users', { preHandler: adminOnly }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      isAdmin?: boolean;
      mustChangePassword?: boolean;
    };
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) {
      return reply.status(400).send({ code: 'E1004', message: 'Valid email required' });
    }

    const generated = !body.password;
    const password = generated ? generateTemporaryPassword() : String(body.password);
    if (password.length < 8) {
      return reply
        .status(400)
        .send({ code: 'E1004', message: 'Password must be at least 8 characters' });
    }

    try {
      const { user } = await userAdmin.directCreate({
        email,
        password,
        isAdmin: Boolean(body.isAdmin),
        mustChangePassword: body.mustChangePassword,
      });
      const response: { user: ReturnType<typeof mapAdminUser>; temporaryPassword?: string } = {
        user: mapAdminUser(user),
      };
      if (generated || body.mustChangePassword) {
        response.temporaryPassword = password;
      }
      return reply.status(201).send(response);
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.patch('/api/admin/users/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      status?: AdminUserRow['status'];
      isAdmin?: boolean;
      resetPassword?: boolean;
    };

    try {
      let temporaryPassword: string | undefined;

      if (body.status !== undefined) {
        await userAdmin.setStatus(id, body.status);
        if (body.status === 'disabled') {
          await authService.deleteUserSessions(id);
        }
      }

      if (body.isAdmin !== undefined) {
        await userAdmin.setAdmin(id, body.isAdmin);
      }

      if (body.resetPassword) {
        const result = await userAdmin.resetPassword(id);
        temporaryPassword = result.temporaryPassword;
        await authService.deleteUserSessions(id);
      }

      return temporaryPassword !== undefined ? { ok: true, temporaryPassword } : { ok: true };
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.delete('/api/admin/users/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await userAdmin.deleteDisabled(id);
      return reply.status(204).send();
    } catch (err) {
      return sendAwfError(reply, err);
    }
  });

  app.post(
    '/api/admin/users/:id/revoke-invite',
    { preHandler: adminOnly },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await userAdmin.revokeInvite(id);
        return { ok: true };
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );

  app.post(
    '/api/admin/users/:id/resend-invite',
    { preHandler: adminOnly },
    async (request, reply) => {
      const runtime = await assertSmtpConfigured(getRuntimeConfig, reply);
      if (!runtime) return;

      const { id } = request.params as { id: string };
      try {
        const user = await users.findById(id);
        if (!user) {
          return reply.status(404).send({ code: 'E1001', message: 'User not found' });
        }

        const { token } = await userAdmin.resendInvite(id, request.auth!.userId);
        const inviteUrl = `${runtime.publicUrl.replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`;
        await sendInviteEmail({
          to: user.email,
          inviteUrl,
          productName: runtime.brand.productName,
        });
        return { ok: true };
      } catch (err) {
        return sendAwfError(reply, err);
      }
    },
  );
}
