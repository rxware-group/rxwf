import { test, expect } from '@playwright/test';

test('create workflow and add Manual node from palette', async ({ page }) => {
  await page.goto('/workflows/new');

  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible();

  await expect(canvas.locator('.react-flow__node')).toHaveCount(1);
  await expect(
    canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Manual$/ }),
  ).toHaveCount(1);

  const palette = page.locator('.editor-palette-pane');
  await palette.getByRole('button', { name: 'Manual' }).click();

  await expect(canvas.locator('.react-flow__node')).toHaveCount(2);
  await expect(
    canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Manual$/ }),
  ).toHaveCount(1);
  await expect(
    canvas.locator('.workflow-node-caption-title').filter({ hasText: /^Manual 2$/ }),
  ).toHaveCount(1);
});
