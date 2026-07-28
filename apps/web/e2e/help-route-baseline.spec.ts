import { test, expect } from '@playwright/test';

test.describe('help route baseline @smoke', () => {
  test('/help responds without HTTP 404', async ({ page }) => {
    const response = await page.goto('/help');
    expect(response?.status()).not.toBe(404);
  });

  test('/help home renders help center markdown', async ({ page }) => {
    await page.goto('/help');

    await expect(page.locator('.help-center-title')).toHaveText('帮助中心');
    await expect(
      page.locator('.help-doc-page').getByRole('heading', { level: 1, name: '帮助中心' }),
    ).toBeVisible();
    await expect(page.locator('.help-doc-page')).toContainText('表达式与 {{ }} 模板');
  });

  test('/help/nodes/loop renders node markdown', async ({ page }) => {
    await page.goto('/help/nodes/loop');

    await expect(
      page.locator('.help-doc-page').getByRole('heading', { level: 1, name: 'Loop 节点' }),
    ).toBeVisible();
    await expect(page.locator('.help-doc-page')).toContainText('batchSize');
  });

  test('/help/expressions renders expressions doc', async ({ page }) => {
    await page.goto('/help/expressions');

    await expect(page.locator('.help-doc-page--missing')).toHaveCount(0);
    await expect(page.locator('.help-doc-page')).toBeVisible();
  });

  test('unknown help slug shows not-found page instead of app 404', async ({ page }) => {
    await page.goto('/help/nodes/does-not-exist');

    await expect(page.getByRole('heading', { name: '未找到该帮助页面' })).toBeVisible();
    await expect(page.locator('.hint')).toHaveText('/help/nodes/does-not-exist');
    await expect(page.locator('.help-doc-home-link')).toHaveText('概览');
  });

  test('help nav tree lists Loop node', async ({ page }) => {
    await page.goto('/help/nodes/loop');

    // Nav label follows NODE_TYPE_META (AC-061), not markdown H1 title.
    await expect(
      page.locator('.help-center-nav-link.is-active').filter({ hasText: 'Loop' }),
    ).toBeVisible();
  });
});
