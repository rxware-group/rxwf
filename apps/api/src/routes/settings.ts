import { createMailer } from '@rxwf/system-settings';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from '../app-context.js';

export function registerSettingsRoutes(
  app: FastifyInstance,
  ctx: Pick<AppContext, 'getRuntimeConfig' | 'authService'>,
  authPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
): void {
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    await authPreHandler(request, reply);
    if (reply.sent) return;
    if (request.auth?.role !== 'admin') {
      await reply.status(403).send({ code: 'E5002', message: 'Admin required' });
    }
  };

  app.get('/api/settings/system', { preHandler: requireAdmin }, async () => {
    const runtime = await ctx.getRuntimeConfig();
    return {
      passwordResetEnabled: runtime.passwordResetEnabled,
      smtpConfigured: Boolean(runtime.smtp.host && runtime.smtp.port && runtime.smtp.from),
    };
  });

  app.post(
    '/api/settings/system/test-email',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const runtime = await ctx.getRuntimeConfig();
      if (!runtime.passwordResetEnabled && !runtime.smtp.host) {
        return reply.status(400).send({ code: 'E1004', message: 'SMTP not configured' });
      }
      const mailer = createMailer(runtime.smtp);
      await mailer.send({
        to: request.auth!.email,
        subject: 'RX-Workflow SMTP 测试',
        text: '这是一封测试邮件，说明 SMTP 配置正确。',
      });
      return { ok: true };
    },
  );
}
