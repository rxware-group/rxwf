import {
  hasTemplateSyntax,
  isExpressionTemplate,
  normalizeExpressionTemplate,
} from '@rxwf/expression/template';

const FIELD_MODES_KEY = '_fieldModes';

export interface NormalizableNode {
  parameters: Record<string, unknown>;
  type?: string;
  [key: string]: unknown;
}

function wrapBareExpression(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const normalized = normalizeExpressionTemplate(trimmed);
  if (isExpressionTemplate(normalized) || hasTemplateSyntax(trimmed)) {
    return normalized;
  }
  return `{{ ${trimmed} }}`;
}

function normalizeStringValue(
  key: string,
  value: string,
  modes: Record<string, string> | undefined,
): string {
  const mode = modes?.[key];
  if (mode === 'fromAi') {
    const trimmed = value.trim();
    if (trimmed.includes('$fromAI') || hasTemplateSyntax(trimmed)) {
      return trimmed;
    }
    return `{{ $fromAI("${key}", "", "string") }}`;
  }
  if (mode === 'expression') {
    return wrapBareExpression(value);
  }
  return value;
}

function walkParameters(
  value: unknown,
  path: string,
  modes: Record<string, string> | undefined,
): unknown {
  if (typeof value === 'string') {
    const key = path.split('.').pop() ?? path;
    return normalizeStringValue(key, value, modes);
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      walkParameters(entry, `${path}[${index}]`, modes),
    );
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === FIELD_MODES_KEY) continue;
      out[key] = walkParameters(entry, path ? `${path}.${key}` : key, modes);
    }
    return out;
  }
  return value;
}

export function normalizeNodeParameters<T extends NormalizableNode>(node: T): T {
  const params = node.parameters ?? {};
  const modes = params[FIELD_MODES_KEY] as Record<string, string> | undefined;
  const nextParams = walkParameters(params, '', modes) as Record<string, unknown>;
  delete nextParams[FIELD_MODES_KEY];

  if (node.type === 'if' && typeof nextParams.condition === 'string') {
    const condition = nextParams.condition.trim();
    if (condition && !hasTemplateSyntax(condition)) {
      nextParams.condition = wrapBareExpression(condition);
    }
  }

  return { ...node, parameters: nextParams };
}

export function normalizeWorkflowDefinition<T extends { nodes: NormalizableNode[] }>(
  definition: T,
): T {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => normalizeNodeParameters(node)),
  };
}
