import { describe, expect, it } from 'vitest';
import { getLocaleBundle, listLocales, normalizeLocaleCode } from './catalog.js';

const AGENT_ERROR_KEYS = [
  'errors.E1012',
  'errors.E1013',
  'errors.E1014',
  'errors.E1022',
  'errors.E1023',
  'errors.E1024',
  'errors.E1030',
  'errors.E1031',
  'errors.E1032',
  'errors.E1033',
  'errors.E1034',
  'errors.E1035',
  'errors.E3004',
  'errors.E3010',
  'errors.E3011',
  'errors.E3012',
  'errors.W1011',
  'errors.W1012',
] as const;

describe('i18n catalog', () => {
  it('lists zh-CN and en-US locales', () => {
    expect(listLocales()).toEqual(['zh-CN', 'en-US']);
    expect(normalizeLocaleCode('en')).toBe('en-US');
  });

  it('returns nav labels for zh-CN', () => {
    const bundle = getLocaleBundle('zh-CN');
    expect(bundle['nav.workflows']).toBe('工作流');
  });

  it('includes variables page and settings nav labels', () => {
    const zh = getLocaleBundle('zh-CN');
    expect(zh['settings.nav.variables']).toBe('变量');
    expect(zh['vars.col.key']).toBe('键');
    expect(zh['vars.addOrUpdate']).toBe('新增 / 更新');
  });

  it('includes pagination labels', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    expect(zh['common.pageInfo']).toBe('第 {page} / {totalPages} 页');
    expect(zh['common.pageSizeOption']).toBe('{size}/页');
    expect(en['common.pageInfo']).toBe('Page {page} of {totalPages}');
    expect(en['common.pageSizeOption']).toBe('{size}/page');
  });

  it('includes chat bot list create flow labels', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    expect(zh['chat.bot.list.creating']).toBe('创建中…');
    expect(zh['chat.bot.list.nameRequired']).toBe('请输入 Bot 名称');
    expect(en['chat.bot.list.creating']).toBe('Creating…');
    expect(en['chat.bot.list.nameRequired']).toBe('Enter a bot name');
  });

  it('includes P4-B/C agent and crew error codes in zh-CN and en', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    for (const key of AGENT_ERROR_KEYS) {
      expect(zh[key], `${key} missing in zh-CN`).toBeTruthy();
      expect(en[key], `${key} missing in en`).toBeTruthy();
    }
  });

  it('includes editor node params/settings tab and runner compact labels', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    expect(zh['editor.tab.params']).toBe('参数');
    expect(zh['editor.tab.settings']).toBe('设置');
    expect(zh['editor.outputPaneHint']).toBeTruthy();
    expect(zh['runners.compact.mode']).toBe('选型');
    expect(zh['editor.http.sendQuery']).toBe('Query 参数');
    expect(zh['editor.http.col.key']).toBe('键');
    expect(en['editor.tab.params']).toBe('Parameters');
    expect(en['editor.tab.settings']).toBe('Settings');
    expect(en['runners.compact.mode']).toBe('Mode');
    expect(en['editor.http.sendQuery']).toBe('Query Parameters');
  });

  it('includes HTTP request body type labels', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    expect(zh['editor.http.bodyType.none']).toBe('无');
    expect(zh['editor.http.bodyType.form-data']).toBe('表单数据');
    expect(zh['editor.http.bodyType.raw']).toBe('原始');
    expect(en['editor.http.bodyType.none']).toBe('none');
    expect(en['editor.http.bodyType.form-data']).toBe('form-data');
    expect(en['editor.http.bodyType.graphql']).toBe('GraphQL');
  });

  it('has identical key sets for zh-CN and en', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('includes help center nav group labels', () => {
    const zh = getLocaleBundle('zh-CN');
    const en = getLocaleBundle('en-US');
    expect(zh['help.nav.editor']).toBe('编辑器');
    expect(zh['help.nav.nodes']).toBe('节点');
    expect(en['help.nav.editor']).toBe('Editor');
    expect(en['help.nav.nodes']).toBe('Nodes');
  });

  it('includes webhook auth mode labels', () => {
    const zh = getLocaleBundle('zh-CN');
    expect(zh['webhook.authMode.label']).toBe('认证方式');
    expect(zh['webhook.authMode.none']).toBe('None');
    expect(zh['webhook.authMode.apiKeyHmac']).toBe('API Key + HMAC Secret');
  });

  it('has no Chinese characters in en bundle values', () => {
    const en = getLocaleBundle('en-US');
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en value for ${key} contains Chinese`).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});
