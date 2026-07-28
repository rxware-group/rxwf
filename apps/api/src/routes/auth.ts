import type { AuthContext } from '@rxwf/identity';
import {
  createAuthService,
  createInviteService,
  createPasswordResetService,
  createUserService,
  SESSION_COOKIE_NAME,
} from '@rxwf/identity';
import type { LiteDatabase } from '@rxwf/providers-lite';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { AwfError } from '@rxwf/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';

const forgotPasswordRateLimit = new Map<string, number>();
const FORGOT_PASSWORD_RATE_LIMIT_MS = 60_000;

function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  reply.header(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.header(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function toPublicUser(
  ctx: AuthContext,
  profile?: { nickname: string; avatarUrl: string } | null,
) {
  return {
    email: ctx.email,
    role: ctx.role,
    mustChangePassword: ctx.mustChangePassword,
    nickname: profile?.nickname ?? '',
    avatarUrl: profile?.avatarUrl ?? '',
  };
}

async function loadPublicUser(
  userService: ReturnType<typeof createUserService>,
  ctx: AuthContext,
) {
  const row = await userService.findById(ctx.userId);
  return toPublicUser(ctx, row);
}

export interface AuthRouteDeps {
  getRuntimeConfig: () => Promise<RuntimeConfig>;
  sendResetEmail?: (opts: {
    to: string;
    resetUrl: string;
    productName: string;
  }) => Promise<void>;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  deps?: AuthRouteDeps,
): void {
  const authService = createAuthService(db);
  const userService = createUserService(db);
  const passwordResetService = createPasswordResetService(db);
  const inviteService = createInviteService(db);

  app.get('/api/auth/status', async (request) => {
    const userCount = await userService.countUsers();
    const needsSetup = userCount === 0;
    const headers = authService.parseRequestHeaders(request.headers);
    const ctx = await authService.authenticate(headers);
    return {
      needsSetup,
      authenticated: Boolean(ctx),
      user: ctx ? await loadPublicUser(userService, ctx) : null,
    };
  });

  app.get('/api/auth/password-reset-status', async () => {
    const runtime = await deps?.getRuntimeConfig();
    return { enabled: runtime?.passwordResetEnabled ?? false };
  });

  app.get('/api/auth/branding', async () => {
    const runtime = await deps?.getRuntimeConfig();
    return {
      productName: runtime?.brand.productName ?? 'RX-Workflow',
      logoUrl: runtime?.brand.logoUrl ?? '',
    };
  });

  app.post('/api/auth/setup', async (request, reply) => {
    try {
      const userCount = await userService.countUsers();
      if (userCount > 0) {
        return reply.status(403).send({
          code: 'E5002',
          message: 'Initial setup already completed',
        });
      }

      const body = (request.body ?? {}) as { email?: string; password?: string };
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || !email.includes('@')) {
        return reply.status(400).send({ code: 'E1004', message: 'Valid email required' });
      }
      if (password.length < 8) {
        return reply
          .status(400)
          .send({ code: 'E1004', message: 'Password must be at least 8 characters' });
      }

      const user = await userService.createUser({
        email,
        password,
        role: 'admin',
      });
      const { token, expiresAt } = await authService.createSession(user.id);
      setSessionCookie(reply, token, expiresAt);
      return reply.status(201).send({
        user: { email: user.email, role: user.role, nickname: '', avatarUrl: '' },
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: 'E5000',
        message: err instanceof Error ? err.message : 'Setup failed',
      });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { email?: string; password?: string };
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || !password) {
        return reply.status(400).send({ code: 'E1004', message: 'Email and password required' });
      }

      const user = await userService.verifyPassword(email, password);
      if (!user) {
        return reply.status(401).send({
          code: 'E4001',
          message: '邮箱或密码错误（系统无默认账号，请用首次创建的管理员账户）',
        });
      }

      await userService.touchLastLogin(user.id);
      const { token, expiresAt } = await authService.createSession(user.id);
      setSessionCookie(reply, token, expiresAt);
      const row = await userService.findById(user.id);
      return {
        user: {
          email: user.email,
          role: user.role,
          nickname: row?.nickname ?? '',
          avatarUrl: row?.avatarUrl ?? '',
        },
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        code: 'E5000',
        message: err instanceof Error ? err.message : 'Login failed',
      });
    }
  });

  app.post('/api/auth/accept-invite', async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string; password?: string };
    const token = String(body.token ?? '');
    const password = String(body.password ?? '');
    if (password.length < 8) {
      return reply
        .status(400)
        .send({ code: 'E1004', message: 'Password must be at least 8 characters' });
    }
    if (!token) {
      return reply.status(400).send({ code: 'E1004', message: 'Token required' });
    }

    try {
      await inviteService.accept(token, password);
      return { ok: true };
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      request.log.error(err);
      return reply.status(500).send({
        code: 'E5000',
        message: err instanceof Error ? err.message : 'Accept invite failed',
      });
    }
  });

  app.post('/api/auth/change-password', async (request, reply) => {
    const headers = authService.parseRequestHeaders(request.headers);
    const ctx = await authService.authenticate(headers);
    if (!ctx) {
      return reply.status(401).send({ code: 'E4001', message: 'Unauthorized' });
    }

    const body = (request.body ?? {}) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const newPassword = String(body.newPassword ?? '');
    if (newPassword.length < 8) {
      return reply
        .status(400)
        .send({ code: 'E1004', message: 'Password must be at least 8 characters' });
    }

    const user = await userService.findById(ctx.userId);
    if (!user) {
      return reply.status(401).send({ code: 'E4001', message: 'Unauthorized' });
    }

    if (!user.mustChangePassword) {
      const currentPassword = String(body.currentPassword ?? '');
      if (!currentPassword) {
        return reply
          .status(400)
          .send({ code: 'E1004', message: 'Current password required' });
      }
      const verified = await userService.verifyPassword(ctx.email, currentPassword);
      if (!verified) {
        return reply.status(400).send({ code: 'E4002', message: 'Current password is incorrect' });
      }
    }

    await userService.updatePassword(ctx.userId, newPassword);
    await userService.setMustChangePassword(ctx.userId, false);
    return { ok: true };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/auth/forgot-password', async (request, reply) => {
    const runtime = await deps?.getRuntimeConfig();
    if (!runtime?.passwordResetEnabled) {
      return reply.status(503).send({ code: 'E5003', message: 'Password reset not configured' });
    }

    const email = String((request.body as { email?: string })?.email ?? '')
      .trim()
      .toLowerCase();
    const now = Date.now();
    const lastRequest = forgotPasswordRateLimit.get(email);
    if (lastRequest !== undefined && now - lastRequest < FORGOT_PASSWORD_RATE_LIMIT_MS) {
      return {
        message: '如果该邮箱已注册，您将收到重置邮件。',
      };
    }
    forgotPasswordRateLimit.set(email, now);

    const user = await userService.findByEmail(email);
    if (user) {
      const { token } = await passwordResetService.createToken(user.id);
      const url = `${runtime.publicUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      await deps!.sendResetEmail!({
        to: email,
        resetUrl: url,
        productName: runtime.brand.productName,
      });
    }

    return {
      message: '如果该邮箱已注册，您将收到重置邮件。',
    };
  });

  app.post('/api/auth/reset-password', async (request, reply) => {
    const body = request.body as { token?: string; password?: string };
    const token = String(body.token ?? '');
    const password = String(body.password ?? '');
    if (password.length < 8) {
      return reply
        .status(400)
        .send({ code: 'E1004', message: 'Password must be at least 8 characters' });
    }

    try {
      await passwordResetService.consumeToken(token, password);
      return { ok: true };
    } catch {
      return reply.status(400).send({ code: 'E4002', message: '链接无效或已过期' });
    }
  });
}
