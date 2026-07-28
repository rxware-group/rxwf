import stringKeyMap from '../../../../packages/i18n-catalog/src/string-key-map.json' with { type: 'json' };
import { t, type LabelMap } from './labels.js';

const KEY_BY_TEXT = stringKeyMap as Record<string, string>;

export function resolveLabel(labels: LabelMap, text: string): string {
  const key = KEY_BY_TEXT[text];
  return key ? t(labels, key) : text;
}
