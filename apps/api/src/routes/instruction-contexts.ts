import type { FastifyInstance } from 'fastify';
import { resolveRules } from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

export function registerInstructionContextRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
): void {
  app.post(
    '/api/instruction-contexts/resolve',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        workspaceRoot?: string;
        ruleMode?: 'off' | 'inherit' | 'explicit';
        ruleSources?: string[];
        ruleExplicitPaths?: string[];
        contextPaths?: string[];
        maxRuleTokens?: number;
      };
      const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
      try {
        const result = await resolveRules({
          workspaceRoot,
          ruleMode: body.ruleMode ?? 'inherit',
          ruleSources: body.ruleSources,
          ruleExplicitPaths: body.ruleExplicitPaths,
          contextPaths: body.contextPaths,
          maxRuleTokens: body.maxRuleTokens,
        });
        return {
          merged: result.merged,
          tokenEstimate: result.tokenEstimate,
          contexts: result.contexts.map((c) => ({
            relativePath: c.relativePath,
            sourceFormat: c.sourceFormat,
            priority: c.priority,
          })),
        };
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/instruction-contexts/reindex',
    { preHandler: authPreHandler },
    async (request) => {
      const body = (request.body ?? {}) as { workspaceRoot?: string };
      const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
      const result = await resolveRules({
        workspaceRoot,
        ruleMode: 'explicit',
        ruleSources: ['rxwf_rules'],
      });
      return {
        indexed: result.contexts.length,
        tokenEstimate: result.tokenEstimate,
      };
    },
  );

  app.get('/api/instruction-contexts', { preHandler: authPreHandler }, async (request) => {
    const q = (request.query ?? {}) as { workspaceRoot?: string };
    const workspaceRoot = String(q.workspaceRoot ?? process.cwd()).trim();
    const result = await resolveRules({
      workspaceRoot,
      ruleMode: 'explicit',
      ruleSources: ['rxwf_rules'],
    });
    return {
      items: result.contexts.map((c) => ({
        slug: `rxwf_rules:${c.relativePath}`,
        sourceFormat: c.sourceFormat,
        filePath: c.relativePath,
        rootPath: workspaceRoot,
        status: 'active',
      })),
    };
  });
}
