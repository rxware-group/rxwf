import { hasTemplateSyntax } from './resolve-template.js';
import {
  isExpressionTemplate,
  normalizeExpressionTemplate,
  unwrapTemplate,
} from './template-syntax.js';
import { validateExpressionSource } from './validate-expression-source.js';

const EMBEDDED_TEMPLATE_RE = /\{\{\s*([\s\S]+?)\s*\}\}/g;
const FIELD_MODES_KEY = '_fieldModes';
const FROM_AI_RE = /\$fromAI\s*\(/;

export interface ExpressionScanTarget {
  nodeId: string;
  nodeName: string;
  fieldPath: string;
  source: string;
}

export interface WorkflowScanNode {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

function collectSourcesFromString(
  value: string,
  target: Omit<ExpressionScanTarget, 'source'>,
  out: ExpressionScanTarget[],
): void {
  const trimmed = value.trim();
  if (!trimmed) return;

  if (!hasTemplateSyntax(trimmed) && !FROM_AI_RE.test(trimmed)) {
    return;
  }

  const normalized = normalizeExpressionTemplate(trimmed);
  if (isExpressionTemplate(normalized)) {
    out.push({ ...target, source: unwrapTemplate(normalized) });
    return;
  }

  EMBEDDED_TEMPLATE_RE.lastIndex = 0;
  for (const match of trimmed.matchAll(EMBEDDED_TEMPLATE_RE)) {
    const inner = match[1]?.trim();
    if (inner) out.push({ ...target, source: inner });
  }
}

function walkValue(
  value: unknown,
  fieldPath: string,
  target: Omit<ExpressionScanTarget, 'source' | 'fieldPath'>,
  out: ExpressionScanTarget[],
): void {
  if (typeof value === 'string') {
    collectSourcesFromString(value, { ...target, fieldPath }, out);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      walkValue(entry, `${fieldPath}[${index}]`, target, out),
    );
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === FIELD_MODES_KEY) continue;
      walkValue(entry, fieldPath ? `${fieldPath}.${key}` : key, target, out);
    }
  }
}

/** Collect JS expression sources from workflow node parameters for static validation. */
export function scanExpressionSources(
  nodes: WorkflowScanNode[],
): ExpressionScanTarget[] {
  const out: ExpressionScanTarget[] = [];
  for (const node of nodes) {
    const target = { nodeId: node.id, nodeName: node.name };
    const params = node.parameters ?? {};
    for (const [key, value] of Object.entries(params)) {
      if (key === FIELD_MODES_KEY) continue;
      walkValue(value, key, target, out);
    }
  }
  return out;
}

export interface ExpressionValidationIssue {
  nodeId: string;
  nodeName: string;
  fieldPath: string;
  message: string;
}

export function validateWorkflowExpressionSources(
  nodes: WorkflowScanNode[],
): ExpressionValidationIssue[] {
  const issues: ExpressionValidationIssue[] = [];
  for (const target of scanExpressionSources(nodes)) {
    const result = validateExpressionSource(target.source);
    if (!result.ok) {
      issues.push({
        nodeId: target.nodeId,
        nodeName: target.nodeName,
        fieldPath: target.fieldPath,
        message: result.message,
      });
    }
  }
  return issues;
}
