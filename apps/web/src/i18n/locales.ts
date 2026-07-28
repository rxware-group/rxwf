export const APP_LOCALES = ['zh-CN', 'en-US'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '中文简体',
  'en-US': 'English',
};

/** Map legacy `en` and unknown values to supported locale codes. */
export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (locale === 'en-US' || locale === 'en') return 'en-US';
  if (locale === 'zh-CN') return 'zh-CN';
  return 'zh-CN';
}
