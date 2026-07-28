export const RXWF_EXPR_DRAG_MIME = 'application/x-rxwf-expr';

export type ExprDragKind = 'nodes' | 'json' | 'context';

export interface AwfExprDragPayload {
  kind: ExprDragKind;
  nodeName?: string;
  path: string[];
  expression: string;
}

export function buildNodesDragExpression(nodeName: string, path: string[]): string {
  const escaped = nodeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const suffix = path.length ? `.${path.join('.')}` : '';
  return `{{ $nodes["${escaped}"].json${suffix} }}`;
}

export function buildJsonDragExpression(path: string[]): string {
  const suffix = path.length ? `.${path.join('.')}` : '';
  return `{{ $json${suffix} }}`;
}

export function buildContextDragExpression(path: string[]): string {
  return `{{ ${path.join('.')} }}`;
}

/** Strip outer `{{ }}` for Code node JS insert (`$vars.aa`, `$json.id`, …). */
export function toCodeJsInsertText(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

export function buildDragPayload(
  kind: ExprDragKind,
  path: string[],
  nodeName?: string,
): AwfExprDragPayload {
  const expression =
    kind === 'nodes' && nodeName
      ? buildNodesDragExpression(nodeName, path)
      : kind === 'json'
        ? buildJsonDragExpression(path)
        : buildContextDragExpression(path);
  return { kind, nodeName, path, expression };
}

export function serializeExprDrag(payload: AwfExprDragPayload): string {
  return JSON.stringify(payload);
}

export function parseExprDrag(data: string): AwfExprDragPayload | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as AwfExprDragPayload;
    if (typeof parsed.expression === 'string') {
      return parsed;
    }
  } catch {
    // legacy: raw expression string
    if (data.includes('{{')) {
      return { kind: 'context', path: [], expression: data };
    }
  }
  return null;
}

/** @deprecated use buildNodesDragExpression */
export function buildDragExpression(nodeName: string, path: string[]): string {
  return buildNodesDragExpression(nodeName, path);
}

/** @deprecated use parseExprDrag */
export function parseAwfExprDrag(data: string): AwfExprDragPayload | null {
  const payload = parseExprDrag(data);
  if (!payload?.nodeName) return null;
  return payload;
}
