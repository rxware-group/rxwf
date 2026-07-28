import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from './validate.js';
import { validateWorkflowDefinition } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '../fixtures/schema-v1');

export type ImportSchemaV1Result =
  | { ok: true; definition: WorkflowDefinition }
  | { ok: false; errors: Array<{ code: string; message: string }> };

/** Simulates workflow JSON import validation for schemaVersion:1 fixtures (AC-021). */
export function importSchemaV1Workflow(raw: unknown): ImportSchemaV1Result {
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      errors: [{ code: 'E1001', message: 'Workflow definition must be a JSON object' }],
    };
  }

  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return {
      ok: false,
      errors: [
        {
          code: 'E1001',
          message: `Unsupported schemaVersion: ${String(record.schemaVersion)}; expected 1`,
        },
      ],
    };
  }

  const definition = raw as WorkflowDefinition;
  const result = validateWorkflowDefinition(definition);
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors.map((e) => ({ code: e.code, message: e.message })),
    };
  }
  return { ok: true, definition };
}

function loadFixture(name: string): unknown {
  const text = readFileSync(join(fixturesDir, name), 'utf8');
  return JSON.parse(text) as unknown;
}

describe('schema v1 import regression (AC-021)', () => {
  it('rejects import when schemaVersion is not 1 with descriptive error', () => {
    const result = importSchemaV1Workflow({
      schemaVersion: 2,
      name: 'Future',
      nodes: [],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/schemaVersion/i);
    }
  });

  it('rejects import when validation fails and reports errors', () => {
    const result = importSchemaV1Workflow({
      schemaVersion: 1,
      name: 'Invalid',
      nodes: [
        {
          id: 's1',
          type: 'skillRun',
          name: 'Skill',
          position: { x: 0, y: 0 },
          parameters: { skillSource: 'path' },
        },
      ],
      connections: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it.each(
    readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.json'))
      .sort(),
  )('imports fixture %s without regression after M-2 changes', (fixtureName) => {
    const result = importSchemaV1Workflow(loadFixture(fixtureName));
    expect(result.ok, formatImportFailure(fixtureName, result)).toBe(true);
  });
});

function formatImportFailure(
  fixtureName: string,
  result: ImportSchemaV1Result,
): string {
  if (result.ok) return '';
  const detail = result.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
  return `fixture ${fixtureName} import failed: ${detail}`;
}
