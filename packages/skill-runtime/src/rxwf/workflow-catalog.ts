import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface WorkflowTemplateEntry {
  relPath: string;
  absolutePath: string;
  id: string;
  name?: string;
}

export async function indexWorkflowTemplates(
  workspaceRoot: string,
): Promise<WorkflowTemplateEntry[]> {
  const dir = join(workspaceRoot, '.rxwf', 'workflows');
  const out: WorkflowTemplateEntry[] = [];

  async function walk(current: string, relPrefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      const full = join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (!ent.name.endsWith('.workflow.yaml') && !ent.name.endsWith('.workflow.yml')) {
        continue;
      }
      const id = ent.name.replace(/\.workflow\.(yaml|yml)$/, '');
      let name: string | undefined;
      try {
        const raw = await readFile(full, 'utf8');
        const nameMatch = /^name:\s*(.+)$/m.exec(raw);
        if (nameMatch) name = nameMatch[1]!.trim().replace(/^["']|["']$/g, '');
      } catch {
        // ignore
      }
      out.push({
        relPath: rel.replace(/\\/g, '/'),
        absolutePath: full,
        id,
        name,
      });
    }
  }

  await walk(dir, '');
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}
