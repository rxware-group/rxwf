import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_TYPE_META } from '../editor/node-type-meta.js';
import { HELP_DOC_NODE_TYPES } from './help-doc-node-types.js';
import { getHelpDoc } from './load-help-doc.js';
import { NODE_HELP_PATH } from './help-registry.js';

/** M-2 legacy doc outside M-6 45-node registry scope. */
export const ALLOWED_EXTRA_NODE_HELP_DOCS = ['skillRun'] as const;

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const NODES_HELP_DIR = join(REPO_ROOT, 'docs/help/zh/nodes');

/**
 * Validates HELP_DOC_NODE_TYPES ↔ NODE_TYPE_META ↔ NODE_HELP_PATH ↔ markdown files.
 * @returns {string[]} human-readable mismatch messages (empty = ok)
 */
export function findHelpRegistryCompletenessErrors(): string[] {
  const errors: string[] = [];
  const registrySet = new Set<string>(HELP_DOC_NODE_TYPES);

  for (const nodeType of HELP_DOC_NODE_TYPES) {
    if (!NODE_TYPE_META[nodeType]) {
      errors.push(`missing NODE_TYPE_META entry: ${nodeType}`);
    }
    const helpPath = NODE_HELP_PATH[nodeType];
    if (helpPath !== `/help/nodes/${nodeType}`) {
      errors.push(`registry path mismatch for ${nodeType}: ${helpPath ?? '(missing)'}`);
    }
    const diskPath = join(NODES_HELP_DIR, `${nodeType}.md`);
    if (!existsSync(diskPath)) {
      errors.push(`missing markdown file: docs/help/zh/nodes/${nodeType}.md`);
    }
    const slug = `nodes/${nodeType}`;
    const bundled = getHelpDoc(slug);
    if (!bundled?.trim()) {
      errors.push(`bundled help doc empty or missing for slug: ${slug}`);
    }
  }

  if (!existsSync(NODES_HELP_DIR)) {
    errors.push(`nodes help directory missing: ${NODES_HELP_DIR}`);
    return errors;
  }

  const allowedExtra = new Set<string>(ALLOWED_EXTRA_NODE_HELP_DOCS);
  for (const fileName of readdirSync(NODES_HELP_DIR)) {
    if (!fileName.endsWith('.md')) continue;
    const base = fileName.slice(0, -3);
    if (!registrySet.has(base) && !allowedExtra.has(base)) {
      errors.push(`orphan node help markdown not in registry: ${base}.md`);
    }
  }

  return errors;
}
