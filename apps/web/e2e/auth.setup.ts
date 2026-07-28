import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as setup, expect } from '@playwright/test';

const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'user.json');

const E2E_EMAIL = 'e2e@test.local';
const E2E_PASSWORD = 'e2e-test-pass';

setup('authenticate', async ({ page }) => {
  let res = await page.request.post('/api/auth/setup', {
    data: { email: E2E_EMAIL, password: E2E_PASSWORD },
  });
  if (!res.ok() && res.status() === 403) {
    res = await page.request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
  }
  expect(res.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '工作流', level: 2 })).toBeVisible();

  await mkdir(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
