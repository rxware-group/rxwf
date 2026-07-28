import { describe, it, expect } from 'vitest';
import { createTestDb } from '@rxwf/providers-lite';
import { buildApp } from '../app.js';

describe('i18n and theme routes', () => {
  it('serves locale bundles and theme tokens (AC-31–34)', async () => {
    const { app } = await buildApp({
      db: await createTestDb(),
      disableScheduler: true,
      disableJobProcessor: true,
    });
    const i18n = await app.inject({ method: 'GET', url: '/api/i18n/zh-CN' });
    expect(i18n.statusCode).toBe(200);
    expect(i18n.json()).toMatchObject({
      locale: 'zh-CN',
      messages: { 'nav.workflows': '工作流' },
    });
    const theme = await app.inject({ method: 'GET', url: '/api/themes/dark' });
    expect(theme.statusCode).toBe(200);
    expect(theme.json()).toHaveProperty('tokens');
    await app.close();
  });
});
