import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  importAntigravityGeminiSkill,
  importCursorSkill,
  parseSkillMd,
} from '@rxwf/skill-runtime';
import { AwfError } from '@rxwf/shared';
import { createLiteSkillRepository, type LiteDatabase } from '@rxwf/providers-lite';
import type { createAuthPreHandler } from '../middleware/auth.js';

function canWrite(role: string): boolean {
  return role === 'admin' || role === 'member';
}

async function scanRxwfSkills(workspaceRoot: string): Promise<
  Array<{ skillRelPath: string; name: string }>
> {
  const base = join(workspaceRoot, '.rxwf', 'skills');
  const found: Array<{ skillRelPath: string; name: string }> = [];

  async function walk(dir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasSkill = entries.some((e) => e.isFile() && e.name === 'SKILL.md');
    if (hasSkill) {
      const raw = await readFile(join(dir, 'SKILL.md'), 'utf8');
      const ir = parseSkillMd(raw, { skillRelPath: rel, packageDir: dir });
      found.push({ skillRelPath: rel, name: ir.name });
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      await walk(join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name);
    }
  }

  await walk(base, '');
  return found;
}

export function registerSkillRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  authPreHandler: ReturnType<typeof createAuthPreHandler>,
): void {
  const repo = createLiteSkillRepository(db);

  app.get('/api/skills', { preHandler: authPreHandler }, async () => ({
    items: await repo.list(),
  }));

  app.get('/api/skills/:id', { preHandler: authPreHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const skill = await repo.getById(id);
    if (!skill) {
      return reply.status(404).send({ code: 'E1041', message: 'Skill not found' });
    }
    return skill;
  });

  app.post('/api/skills/import', { preHandler: authPreHandler }, async (request, reply) => {
    if (!canWrite(request.auth!.role)) {
      return reply.status(403).send({ code: 'E1003', message: 'Forbidden' });
    }
    const body = (request.body ?? {}) as {
      sourcePath?: string;
      workspaceRoot?: string;
      skillName?: string;
      sourceFormat?: string;
      overwrite?: boolean;
    };
    const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
    const sourcePath = String(body.sourcePath ?? '').trim();
    if (!sourcePath) {
      return reply.status(400).send({ code: 'E1040', message: 'sourcePath required' });
    }
    try {
      const format = String(body.sourceFormat ?? 'cursor').trim();
      const imported =
        format === 'antigravity_gemini' || format === 'antigravity'
          ? await importAntigravityGeminiSkill({
              workspaceRoot,
              skillName: body.skillName,
              sourcePath: sourcePath || undefined,
              overwrite: body.overwrite,
            })
          : await importCursorSkill({
              sourcePath,
              workspaceRoot,
              skillName: body.skillName,
              overwrite: body.overwrite,
            });
      const { skillRelPath } = imported;
      const pkgDir = join(workspaceRoot, '.rxwf', 'skills', skillRelPath);
      const raw = await readFile(join(pkgDir, 'SKILL.md'), 'utf8');
      const ir = parseSkillMd(raw, { skillRelPath, packageDir: pkgDir });
      const record = await repo.upsert({
        slug: skillRelPath,
        name: ir.name,
        description: ir.description,
        sourceFormat: body.sourceFormat ?? 'cursor',
        permissions: ir.permissions,
        files: [{ path: 'SKILL.md', content: raw }],
      });
      return reply.status(201).send({ skill: record, skillRelPath, skillPath: `.rxwf/skills/${skillRelPath}` });
    } catch (err) {
      if (err instanceof AwfError) {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/skills/scan', { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body ?? {}) as { workspaceRoot?: string; runnerId?: string };
    const workspaceRoot = String(body.workspaceRoot ?? process.cwd()).trim();
    const discovered = await scanRxwfSkills(workspaceRoot);
    for (const d of discovered) {
      const pkgDir = join(workspaceRoot, '.rxwf', 'skills', d.skillRelPath);
      const raw = await readFile(join(pkgDir, 'SKILL.md'), 'utf8');
      const ir = parseSkillMd(raw, { skillRelPath: d.skillRelPath, packageDir: pkgDir });
      await repo.upsert({
        slug: d.skillRelPath,
        name: ir.name,
        description: ir.description,
        sourceFormat: 'rxwf',
        permissions: ir.permissions,
        files: [{ path: 'SKILL.md', content: raw }],
      });
    }
    await repo.recordScanRoot(workspaceRoot, body.runnerId, discovered.length);
    return { skillsFound: discovered.length, items: discovered };
  });
}
