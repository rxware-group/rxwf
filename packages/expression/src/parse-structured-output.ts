import { AwfError } from '@rxwf/shared';

/** Extract JSON object from agent answer (markdown code block or raw JSON). */
export function extractJsonFromAgentAnswer(answer: string): unknown {
  const trimmed = answer.trim();
  if (!trimmed) {
    throw new AwfError('E3013', 'Agent returned empty answer for structured output');
  }

  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (codeBlock?.[1] ?? trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    throw new AwfError('E3013', 'Agent answer is not valid JSON for Output Parser');
  }
}

function assertSchemaShape(
  value: unknown,
  schema: Record<string, unknown>,
  path = 'root',
): void {
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    const properties =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : {};
    for (const key of required) {
      if (!(key in (value as Record<string, unknown>))) {
        throw new AwfError('E3013', `Structured output missing required property "${key}" at ${path}`);
      }
    }
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in (value as Record<string, unknown>)) {
        assertSchemaShape((value as Record<string, unknown>)[key], propSchema, `${path}.${key}`);
      }
    }
    return;
  }

  const expectedType = schema.type;
  if (!expectedType || typeof expectedType !== 'string') return;

  const actual =
    Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

  const typeOk =
    expectedType === actual ||
    (expectedType === 'integer' && actual === 'number') ||
    (expectedType === 'number' && actual === 'number');

  if (!typeOk) {
    throw new AwfError(
      'E3013',
      `Structured output type mismatch at ${path}: expected ${expectedType}, got ${actual}`,
    );
  }
}

export function parseAgentStructuredOutput(
  answer: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = extractJsonFromAgentAnswer(answer);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AwfError('E3013', 'Structured output must be a JSON object');
  }
  assertSchemaShape(parsed, schema);
  return parsed as Record<string, unknown>;
}

export function buildOutputParserSystemHint(schema: Record<string, unknown>): string {
  return [
    'You must respond with valid JSON only (no markdown unless inside a single json code block).',
    'Match this JSON Schema:',
    JSON.stringify(schema, null, 2),
  ].join('\n');
}
