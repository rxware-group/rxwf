import { t, type LabelMap } from '../../i18n/labels.js';

export type WebhookListenError = {
  code?: string;
  message: string;
};

export function formatWebhookListenError(
  error: WebhookListenError,
  labels: LabelMap,
): string {
  if (error.code) {
    const localized = t(labels, `errors.${error.code}`, undefined, '');
    if (localized) {
      return `${error.code} · ${localized}`;
    }
    return `${error.code} · ${error.message}`;
  }
  return error.message;
}

export function isWebhookAuthErrorCode(code?: string): boolean {
  return code === 'E2005' || code === 'E2006' || code === 'E2014';
}
