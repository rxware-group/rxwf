import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexWorkflowTemplates } from './workflow-catalog.js';

describe('indexWorkflowTemplates', () => {
  it('finds .rxwf/workflows/*.workflow.yaml', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-wf-'));
    const dir = join(root, '.rxwf', 'workflows');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'startcycle.workflow.yaml'),
      'manifestVersion: 1\nid: startcycle\nname: Start\nsteps: []\n',
    );
    const items = await indexWorkflowTemplates(root);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('startcycle');
  });
});
