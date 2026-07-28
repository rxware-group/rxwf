import { SETTING_KEYS } from '@rxwf/system-settings';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app-context.js';

export function registerRxwfWorkspaceRoutes(
  app: FastifyInstance,
  ctx: Pick<AppContext, 'settingsService'>,
  authPreHandler: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>,
): void {
  app.get('/api/rxwf/workspace', { preHandler: authPreHandler }, async () => {
    const workspaceRoot = (await ctx.settingsService.get(SETTING_KEYS.rxwfWorkspaceRoot)) ?? '';
    return { workspaceRoot };
  });

  app.put('/api/rxwf/workspace', { preHandler: authPreHandler }, async (request) => {
    const body = (request.body ?? {}) as { workspaceRoot?: string };
    const workspaceRoot = String(body.workspaceRoot ?? '').trim();
    await ctx.settingsService.set(SETTING_KEYS.rxwfWorkspaceRoot, workspaceRoot);
    return { ok: true, workspaceRoot };
  });
}
