import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { LiteDatabase } from './db.js';
import { skillFiles, skillScanRoots, skills } from './drizzle/schema.js';

export interface SkillRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sourceFormat: string;
  version: string;
  status: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function createLiteSkillRepository(db: LiteDatabase) {
  return {
    async list(): Promise<SkillRecord[]> {
      const rows = await db.select().from(skills).orderBy(desc(skills.updatedAt));
      return rows.map(mapSkill);
    },

    async getById(id: string): Promise<SkillRecord | null> {
      const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
      return rows[0] ? mapSkill(rows[0]) : null;
    },

    async getSkillMd(
      id: string,
    ): Promise<{ slug: string; content: string } | null> {
      const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
      if (!rows[0]) return null;
      const fileRows = await db
        .select()
        .from(skillFiles)
        .where(and(eq(skillFiles.skillId, id), eq(skillFiles.path, 'SKILL.md')))
        .limit(1);
      const content = fileRows[0]?.content;
      if (!content?.trim()) return null;
      return { slug: rows[0].slug, content };
    },

    async upsert(input: {
      slug: string;
      name: string;
      description?: string;
      sourceFormat: string;
      permissions?: string[];
      files?: Array<{ path: string; content: string }>;
    }): Promise<SkillRecord> {
      const now = new Date();
      const existing = await db
        .select()
        .from(skills)
        .where(eq(skills.slug, input.slug))
        .limit(1);
      const id = existing[0]?.id ?? randomUUID();
      const row = {
        id,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        sourceFormat: input.sourceFormat,
        version: existing[0]?.version ?? '1.0.0',
        status: 'active',
        permissionsJson: JSON.stringify(input.permissions ?? []),
        createdBy: null,
        createdAt: existing[0]?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing[0]) {
        await db.update(skills).set(row).where(eq(skills.id, id));
      } else {
        await db.insert(skills).values(row);
      }
      if (input.files?.length) {
        await db.delete(skillFiles).where(eq(skillFiles.skillId, id));
        for (const f of input.files) {
          await db.insert(skillFiles).values({
            skillId: id,
            path: f.path,
            content: f.content,
            contentHash: hashContent(f.content),
          });
        }
      }
      return mapSkill(row);
    },

    async recordScanRoot(rootPath: string, runnerId?: string, skillsFound = 0): Promise<void> {
      const id = randomUUID();
      await db.insert(skillScanRoots).values({
        id,
        runnerId: runnerId ?? null,
        rootPath,
        lastScanAt: new Date(),
        skillsFound,
      });
    },
  };
}

function mapSkill(row: typeof skills.$inferSelect): SkillRecord {
  let permissions: string[] = [];
  try {
    permissions = JSON.parse(row.permissionsJson) as string[];
  } catch {
    permissions = [];
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sourceFormat: row.sourceFormat,
    version: row.version,
    status: row.status,
    permissions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
