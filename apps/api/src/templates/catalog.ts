import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkflowDefinition } from '@rxwf/workflow';

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../fixtures/templates',
);

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'agent';
}

function templatePath(id: string): string {
  return join(TEMPLATES_DIR, `${id}.json`);
}

export function listTemplateCatalog(): TemplateMeta[] {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const id = file.replace(/\.json$/, '');
      const raw = JSON.parse(readFileSync(join(TEMPLATES_DIR, file), 'utf8')) as {
        name?: string;
        description?: string;
        category?: 'automation' | 'agent';
      };
      return {
        id,
        name: raw.name ?? id,
        description: raw.description ?? '',
        category: (raw.category === 'agent' ? 'agent' : 'automation') as TemplateMeta['category'],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadTemplateDefinition(id: string): WorkflowDefinition {
  const path = templatePath(id);
  if (!existsSync(path)) {
    throw new Error(`Template not found: ${id}`);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as WorkflowDefinition & {
    description?: string;
    category?: string;
  };
  const { description: _desc, category: _cat, ...definition } = raw;
  return definition;
}
