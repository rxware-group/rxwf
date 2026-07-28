import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { parseIndexFile } from '../../../scripts/lint-docs-index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const indexContent = readFileSync(path.join(repoRoot, 'docs/INDEX.md'), 'utf8');
const { entryPaths } = parseIndexFile(indexContent);

function helpPathFromIndexEntry(entryPath: string): string | null {
  const match = entryPath.match(/^docs\/help\/zh\/(.+)\.md$/);
  if (!match) return null;
  const slug = match[1] === 'index' ? '' : match[1];
  return slug ? `/help/${slug}` : '/help';
}

const indexHelpPaths = entryPaths
  .map(helpPathFromIndexEntry)
  .filter((helpPath): helpPath is string => helpPath !== null);

test.describe('docs INDEX smoke @smoke', () => {
  test('docs/INDEX.md registers core governance docs', () => {
    expect(entryPaths).toContain('docs/INDEX.md');
    expect(entryPaths).toContain('docs/README.md');
    expect(entryPaths).toContain('docs/spec.md');
    expect(entryPaths.filter((p) => p.startsWith('docs/help/zh/')).length).toBeGreaterThanOrEqual(3);
  });

  test('help home mentions developer docs/ tree', async ({ page }) => {
    await page.goto('/help');

    await expect(page.locator('.help-doc-page')).toContainText('docs/');
    await expect(page.locator('.help-doc-page')).toContainText('开发者文档');
  });

  for (const helpPath of indexHelpPaths) {
    test(`INDEX help entry loads at ${helpPath}`, async ({ page }) => {
      await page.goto(helpPath);

      await expect(page.locator('.help-doc-page')).toBeVisible();
      await expect(page.locator('.help-doc-page--missing')).toHaveCount(0);
    });
  }
});
