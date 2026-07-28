import { AwfError } from '@rxwf/shared';

const TEMPLATE_RE = /^\{\{\s*(.+?)\s*\}\}$/s;
const N8N_TEMPLATE_RE = /^=\{\{\s*(.+?)\s*\}\}$/s;
const EMBEDDED_TEMPLATE_RE = /\{\{\s*([\s\S]+?)\s*\}\}/g;

/** n8n 使用 `={{ expr }}`，AWF 使用 `{{ expr }}`；统一为 AWF 形式。 */
export function normalizeExpressionTemplate(value: string): string {
  const trimmed = value.trim();
  const n8n = N8N_TEMPLATE_RE.exec(trimmed);
  if (n8n) {
    return `{{ ${n8n[1]!.trim()} }}`;
  }
  return trimmed;
}

export function isExpressionTemplate(value: string): boolean {
  const normalized = normalizeExpressionTemplate(value.trim());
  if (!TEMPLATE_RE.test(normalized)) {
    return false;
  }
  const opens = normalized.match(/\{\{/g)?.length ?? 0;
  const closes = normalized.match(/\}\}/g)?.length ?? 0;
  return opens === 1 && closes === 1;
}

export function unwrapTemplate(template: string): string {
  const normalized = normalizeExpressionTemplate(template);
  const match = TEMPLATE_RE.exec(normalized);
  if (!match) {
    throw new AwfError(
      'E1002',
      'Expression must be a single {{ }} or n8n ={{ }} template',
    );
  }
  return match[1]!.trim();
}

export function hasTemplateSyntax(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isExpressionTemplate(trimmed) || isExpressionTemplate(normalizeExpressionTemplate(trimmed))) {
    return true;
  }
  EMBEDDED_TEMPLATE_RE.lastIndex = 0;
  const found = EMBEDDED_TEMPLATE_RE.test(value);
  EMBEDDED_TEMPLATE_RE.lastIndex = 0;
  return found;
}
