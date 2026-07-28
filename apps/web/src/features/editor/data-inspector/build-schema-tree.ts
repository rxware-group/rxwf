export type SchemaNodeType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';

export interface SchemaTreeNode {
  key: string;
  path: string[];
  type: SchemaNodeType;
  preview?: string;
  children?: SchemaTreeNode[];
}

function inferType(value: unknown): SchemaNodeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

function previewValue(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    return value.length > 48 ? `${value.slice(0, 45)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return undefined;
  }
  return String(value);
}

export function buildSchemaNode(key: string, path: string[], value: unknown): SchemaTreeNode {
  const type = inferType(value);
  const preview = previewValue(value);
  const node: SchemaTreeNode = { key, path, type, ...(preview != null && { preview }) };
  if (type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    node.children = Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      buildSchemaNode(k, [...path, k], v),
    );
  } else if (type === 'array' && Array.isArray(value)) {
    node.children = value.slice(0, 20).map((entry, index) =>
      buildSchemaNode(String(index), [...path, String(index)], entry),
    );
  }
  return node;
}

/** Build schema tree from workflow items (uses first item json structure). */
export function buildSchemaTree(
  items: { json: Record<string, unknown> }[],
): SchemaTreeNode[] {
  const first = items[0]?.json ?? {};
  return Object.entries(first).map(([key, value]) => buildSchemaNode(key, [key], value));
}
