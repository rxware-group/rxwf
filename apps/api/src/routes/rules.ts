import type { FastifyInstance } from 'fastify';
import { importCursorRules } from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

export function registerRulesRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
): void {
  app.post('/api/rules/import', { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      sourcePath?: string;
      workspaceRoot?: string;
      overwrite?: boolean;
    };
    const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
    const sourcePath = String(body.sourcePath ?? '').trim();
    if (!sourcePath) {
      return reply.status(400).send({ code: 'E1040', message: 'sourcePath required' });
    }
    if (/CLAUDE\.md|\.claude\/rules/i.test(sourcePath)) {
      return reply.status(400).send({
        code: 'E1070',
        message: 'CLAUDE.md and .claude/rules are not supported; import AGENTS.md via rules_import',
      });
    }
    try {
      const result = await importCursorRules({
        sourcePath,
        workspaceRoot,
        overwrite: body.overwrite,
      });
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });
}
