export type FromAiValueType = 'string' | 'number' | 'boolean' | 'json';

export interface FromAiSpec {
  key: string;
  description?: string;
  type: FromAiValueType;
  defaultValue?: unknown;
}

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Matches `$fromAI("key", ...)` inside or outside `{{ }}`. */
const FROM_AI_CALL_RE =
  /(?:\{\{\s*)?\$fromAI\s*\(\s*(['"])([^'"]+)\1(?:\s*,\s*(['"])([\s\S]*?)\3)?(?:\s*,\s*(['"])(string|number|boolean|json)\5)?(?:\s*,\s*([\s\S]+?))?\s*\)(?:\s*\}\})?/gi;

function parseDefaultValue(raw: string | undefined, type: FromAiValueType): unknown {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (type === 'number') {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') {
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return undefined;
  }
  if (type === 'json') {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFromAiCallMatch(
  key: string,
  description?: string,
  typeRaw?: string,
  defaultRaw?: string,
): FromAiSpec | null {
  const trimmedKey = key.trim();
  if (!KEY_RE.test(trimmedKey)) return null;
  const type = (typeRaw?.trim() as FromAiValueType | undefined) ?? 'string';
  if (!['string', 'number', 'boolean', 'json'].includes(type)) {
    return null;
  }
  return {
    key: trimmedKey,
    description: description?.trim() || undefined,
    type,
    defaultValue: parseDefaultValue(defaultRaw, type),
  };
}

/** Parse all `$fromAI(...)` calls in a string. */
export function parseFromAiCalls(text: string): FromAiSpec[] {
  const specs = new Map<string, FromAiSpec>();
  FROM_AI_CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FROM_AI_CALL_RE.exec(text)) !== null) {
    const key = match[2];
    if (!key) continue;
    const spec = parseFromAiCallMatch(key, match[4], match[6], match[7]);
    if (spec) specs.set(spec.key, spec);
  }
  return [...specs.values()];
}

export function formatFromAiCall(spec: FromAiSpec): string {
  const parts = [`"${spec.key}"`];
  if (spec.description) parts.push(`"${spec.description.replace(/"/g, '\\"')}"`);
  if (spec.type !== 'string') {
    if (!spec.description) parts.push('""');
    parts.push(`"${spec.type}"`);
  }
  if (spec.defaultValue !== undefined) {
    if (!spec.description && spec.type === 'string') parts.push('""');
    else if (!spec.description) parts.push(`"${spec.type}"`);
    const dv =
      typeof spec.defaultValue === 'string'
        ? `"${spec.defaultValue.replace(/"/g, '\\"')}"`
        : JSON.stringify(spec.defaultValue);
    parts.push(dv);
  }
  return `$fromAI(${parts.join(', ')})`;
}

function mergeSpec(into: Map<string, FromAiSpec>, spec: FromAiSpec): void {
  const prev = into.get(spec.key);
  if (!prev) {
    into.set(spec.key, spec);
    return;
  }
  into.set(spec.key, {
    key: spec.key,
    description: spec.description ?? prev.description,
    type: spec.type !== 'string' ? spec.type : prev.type,
    defaultValue: spec.defaultValue ?? prev.defaultValue,
  });
}

function scanFromAiInValue(
  value: unknown,
  fieldKey: string | undefined,
  fieldModes: Record<string, string> | undefined,
  into: Map<string, FromAiSpec>,
): void {
  if (typeof value === 'string') {
    if (fieldKey && fieldModes?.[fieldKey] === 'fromAi') {
      const trimmed = value.trim();
      if (trimmed) {
        if (trimmed.includes('$fromAI')) {
          for (const spec of parseFromAiCalls(trimmed)) mergeSpec(into, spec);
        } else if (KEY_RE.test(trimmed)) {
          mergeSpec(into, { key: trimmed, type: 'string' });
        }
      }
    } else {
      for (const spec of parseFromAiCalls(value)) mergeSpec(into, spec);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) scanFromAiInValue(entry, undefined, fieldModes, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, entry] of Object.entries(value as Record<string, unknown>)) {
      scanFromAiInValue(entry, k, fieldModes, into);
    }
  }
}

/** Collect unique `$fromAI` specs from tool node parameters (incl. `_fieldModes.fromAi`). */
export function collectFromAiSpecsFromToolParams(
  params: Record<string, unknown>,
): FromAiSpec[] {
  const modes = params._fieldModes as Record<string, string> | undefined;
  const specs = new Map<string, FromAiSpec>();
  for (const [key, value] of Object.entries(params)) {
    if (key === '_fieldModes') continue;
    scanFromAiInValue(value, key, modes, specs);
  }
  return [...specs.values()];
}

/** Build JSON Schema object for LangChain / OpenAI tool parameters. */
export function buildJsonSchemaFromFromAiSpecs(specs: FromAiSpec[]): Record<string, unknown> {
  if (specs.length === 0) {
    return { type: 'object', properties: {} };
  }
  const properties: Record<string, unknown> = {};
  for (const spec of specs) {
    const prop: Record<string, unknown> = {
      type: spec.type === 'json' ? 'object' : spec.type,
    };
    if (spec.description) prop.description = spec.description;
    if (spec.defaultValue !== undefined) prop.default = spec.defaultValue;
    properties[spec.key] = prop;
  }
  return {
    type: 'object',
    properties,
    required: specs.map((s) => s.key),
    additionalProperties: false,
  };
}

function formatFromAiValue(value: unknown, type: FromAiValueType): string {
  if (value === undefined || value === null) return '';
  if (type === 'json') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/** Replace `$fromAI(...)` placeholders with values from the LLM tool-call args. */
export function substituteFromAiInString(
  template: string,
  args: Record<string, unknown>,
): string {
  FROM_AI_CALL_RE.lastIndex = 0;
  return template.replace(FROM_AI_CALL_RE, (full, ...groups) => {
    const key = groups[1] as string;
    const description = groups[3] as string | undefined;
    const typeRaw = groups[5] as string | undefined;
    const defaultRaw = groups[6] as string | undefined;
    const spec = parseFromAiCallMatch(key, description, typeRaw, defaultRaw);
    if (!spec) return full;
    const value = args[spec.key] ?? spec.defaultValue;
    return formatFromAiValue(value, spec.type);
  });
}

/** Resolve a tool parameter string: substitute `$fromAI`, then optional template pass. */
export function resolveToolParamWithFromAi(
  raw: string,
  fieldKey: string,
  params: Record<string, unknown>,
  llmArgs: Record<string, unknown>,
): string {
  const modes = params._fieldModes as Record<string, string> | undefined;
  let value = raw;
  if (modes?.[fieldKey] === 'fromAi') {
    const trimmed = raw.trim();
    if (trimmed && !trimmed.includes('$fromAI') && KEY_RE.test(trimmed)) {
      value = formatFromAiCall({ key: trimmed, type: 'string' });
    }
  }
  return substituteFromAiInString(value, llmArgs);
}
