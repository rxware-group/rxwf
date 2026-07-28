import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_DOC_NODE_TYPES } from '../src/features/help/help-doc-node-types.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const NODES_HELP_DIR = join(REPO_ROOT, 'docs/help/zh/nodes');

function expectedH1(nodeType: string): string {
  const raw = readFileSync(join(NODES_HELP_DIR, `${nodeType}.md`), 'utf8');
  const match = raw.match(/^#\s+(.+)$/m);
  if (!match?.[1]) {
    throw new Error(`missing H1 in docs/help/zh/nodes/${nodeType}.md`);
  }
  return match[1].trim();
}

test.describe('help all registered node types @smoke', () => {
  test('registry lists 45 node types', () => {
    expect(HELP_DOC_NODE_TYPES).toHaveLength(45);
  });

  for (const nodeType of HELP_DOC_NODE_TYPES) {
    test(`/help/nodes/${nodeType} renders markdown`, async ({ page }) => {
      const response = await page.goto(`/help/nodes/${nodeType}`);
      expect(response?.status()).not.toBe(404);

      await expect(page.locator('.help-doc-page--missing')).toHaveCount(0);
      await expect(page.locator('.help-doc-page')).toBeVisible();
      await expect(
        page.locator('.help-doc-page').getByRole('heading', { level: 1, name: expectedH1(nodeType) }),
      ).toBeVisible();
    });
  }
});
