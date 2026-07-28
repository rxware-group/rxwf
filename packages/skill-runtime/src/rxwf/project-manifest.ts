import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillError } from '../errors.js';

export interface RxwfProjectManifest {
  manifestVersion?: number;
  name?: string;
  workflows?: { enabled?: boolean };
  defaultRuleSources?: string[];
  enableProjectScripts?: boolean;
}

export async function readRxwfProjectManifest(
  workspaceRoot: string,
): Promise<RxwfProjectManifest | null> {
  const path = join(workspaceRoot, '.rxwf', 'rxwf.project.json');
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as RxwfProjectManifest;
  } catch {
    return null;
  }
}

export async function assertWorkflowsEnabled(workspaceRoot: string): Promise<void> {
  const manifest = await readRxwfProjectManifest(workspaceRoot);
  if (manifest?.workflows?.enabled === false) {
    throw skillError('E1075', 'Workflow templates are disabled in rxwf.project.json');
  }
}
