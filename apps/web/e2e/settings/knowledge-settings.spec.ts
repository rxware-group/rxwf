import { test, expect } from '@playwright/test';

/** Knowledge platform settings page smoke (AC-K1 partial). */

test.describe('knowledge platform settings @smoke', () => {
  test('settings page renders knowledge sections', async ({ page }) => {
    await page.goto('/settings/knowledge');

    const dialog = page.getByRole('dialog', { name: '设置' });
    await expect(dialog.getByRole('heading', { name: '知识库', level: 1 })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '向量化（Embedding）', level: 2 })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'RAG 对话（LLM）', level: 2 })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: '新建知识库默认值', level: 2 })).toBeVisible();
  });

  test('GET /api/settings/knowledge is available to authenticated user', async ({ request }) => {
    const res = await request.get('/api/settings/knowledge');
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { configured?: boolean; embedding?: { provider?: string } };
    expect(body.embedding?.provider).toBeTruthy();
    expect(typeof body.configured).toBe('boolean');
  });
});
