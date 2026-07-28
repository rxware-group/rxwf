import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  WorkflowCompiler,
  indexRxwfCommands,
  indexRxwfHooks,
  indexWorkflowTemplates,
  parseAntigravityWorkflowYaml,
} from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import type { createAuthPreHandler } from '../middleware/auth.js';

export function registerWorkflowsCatalogRoutes(
  app: FastifyInstance,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
): void {
  app.get(
    '/api/rxwf-catalog/hooks',
    { preHandler: authPreHandler },
    async (request) => {
      const q = (request.query ?? {}) as { workspaceRoot?: string };
      const workspaceRoot = String(q.workspaceRoot ?? process.cwd()).trim();
      return { items: await indexRxwfHooks(workspaceRoot) };
    },
  );

  app.get(
    '/api/rxwf-catalog/commands',
    { preHandler: authPreHandler },
    async (request) => {
      const q = (request.query ?? {}) as { workspaceRoot?: string };
      const workspaceRoot = String(q.workspaceRoot ?? process.cwd()).trim();
      return { items: await indexRxwfCommands(workspaceRoot) };
    },
  );

  app.get(
    '/api/rxwf-catalog/workflows',
    { preHandler: authPreHandler },
    async (request) => {
      const q = (request.query ?? {}) as { workspaceRoot?: string };
      const workspaceRoot = String(q.workspaceRoot ?? process.cwd()).trim();
      const items = await indexWorkflowTemplates(workspaceRoot);
      return { items };
    },
  );

  app.post(
    '/api/workflows/import',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        workspaceRoot?: string;
        templateId?: string;
        yaml?: string;
      };
      const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
      const yaml = String(body.yaml ?? '').trim();
      const templateId = String(body.templateId ?? 'imported').trim();
      if (!yaml) {
        return reply.status(400).send({ code: 'E1040', message: 'yaml required' });
      }
      const dir = join(workspaceRoot, '.rxwf', 'workflows');
      await mkdir(dir, { recursive: true });
      const fileName = `${templateId}.workflow.yaml`;
      const filePath = join(dir, fileName);
      await writeFile(filePath, yaml, 'utf8');
      return reply.status(201).send({ relPath: fileName, path: filePath });
    },
  );

  app.post(
    '/api/rxwf-catalog/workflows/compile-by-path',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        workspaceRoot?: string;
        relPath?: string;
        compileMode?: 'linear_skillRun' | 'subagent_satellite';
      };
      const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
      const relPath = String(body.relPath ?? '').trim().replace(/\\/g, '/');
      if (!relPath) {
        return reply.status(400).send({ code: 'E1040', message: 'relPath required' });
      }
      if (relPath.includes('..')) {
        return reply.status(400).send({ code: 'E1040', message: 'invalid relPath' });
      }
      const filePath = join(workspaceRoot, '.rxwf', 'workflows', relPath);
      try {
        const yaml = await readFile(filePath, 'utf8');
        const ir = parseAntigravityWorkflowYaml(yaml);
        const compiled = new WorkflowCompiler().compile(ir, {
          compileMode: body.compileMode ?? 'linear_skillRun',
          workspaceRootTemplate: '{{$workspaceRoot}}',
        });
        return { definition: compiled, meta: compiled.meta, relPath };
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        const code = (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 'E1041' : 'E1040';
        return reply.status(400).send({
          code,
          message: err instanceof Error ? err.message : 'Failed to compile workflow template',
        });
      }
    },
  );

  app.post(
    '/api/rxwf-catalog/workflows/import-to-workflow',
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        workspaceRoot?: string;
        yaml?: string;
        compileMode?: 'linear_skillRun' | 'subagent_satellite';
      };
      const yaml = String(body.yaml ?? '').trim();
      if (!yaml) {
        return reply.status(400).send({ code: 'E1040', message: 'yaml required' });
      }
      try {
        const ir = parseAntigravityWorkflowYaml(yaml);
        const compiled = new WorkflowCompiler().compile(ir, {
          compileMode: body.compileMode ?? 'linear_skillRun',
          workspaceRootTemplate: '{{$workspaceRoot}}',
        });
        return { definition: compiled, meta: compiled.meta };
      } catch (err) {
        if (err instanceof AwfError) {
          return reply.status(400).send({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
