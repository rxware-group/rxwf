import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/** Parity with binary-full-chain.spec.ts stripDataUriBase64 (httpbin data-URI echo). */
function stripDataUriBase64(value: string | undefined): string {
  if (!value) return '';
  const match = /^data:[^;]+;base64,(.+)$/s.exec(value);
  return match ? match[1]! : value;
}

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.join(e2eDir, 'binary-full-chain.spec.ts');

export const MATRIX_ROW_ID = 'E2E-P-014';
export const REQUIRED_SCENARIO_TAGS = ['AC-048', 'AC-049', 'AC-050', 'AC-052'] as const;

const REQUIRED_MARKERS = [
  'E2E-P-014',
  'AC-052',
  'AC-048',
  'AC-049',
  'AC-050',
  '@standard',
  'BINARY_FULL_CHAIN_E2E_GREEN',
  'responseBinaryMode',
  'multipart',
  '$binary',
  'binaryFromItem',
  'stripDataUriBase64',
] as const;

export function validateBinaryFullChainSpec(content: string) {
  const errors: string[] = [];
  for (const marker of REQUIRED_MARKERS) {
    if (!content.includes(marker)) {
      errors.push(`missing marker: ${marker}`);
    }
  }
  if (!/test\.describe\(['"]AC-048/.test(content)) {
    errors.push('missing AC-048 describe block');
  }
  if (!/test\.describe\(['"]AC-049/.test(content)) {
    errors.push('missing AC-049 describe block');
  }
  if (!/test\.describe\(['"]AC-050/.test(content)) {
    errors.push('missing AC-050 describe block');
  }
  if (!/test\.describe\(['"]AC-052/.test(content)) {
    errors.push('missing AC-052 describe block');
  }
  return { ok: errors.length === 0, errors };
}

function registerStructureTests(): void {
  describe('binary-full-chain.spec.ts structure (T-111 / AC-052)', () => {
    it('spec file exists under apps/web/e2e', () => {
      assert.ok(existsSync(SPEC_PATH), `${SPEC_PATH} missing`);
    });

    it('covers E2E-P-014 upload/download/expression/full-chain scenarios', () => {
      const content = readFileSync(SPEC_PATH, 'utf8');
      const result = validateBinaryFullChainSpec(content);
      assert.equal(result.ok, true, result.errors.join('; '));
    });

    it('exports BINARY_FULL_CHAIN_E2E_GREEN gate (true when Green)', () => {
      const content = readFileSync(SPEC_PATH, 'utf8');
      assert.match(
        content,
        /export const BINARY_FULL_CHAIN_E2E_GREEN = (true|false);/,
        'Gate constant must be exported',
      );
    });

    it('maps matrix row E2E-P-014', () => {
      const content = readFileSync(SPEC_PATH, 'utf8');
      assert.match(content, /MATRIX_ROW_ID = 'E2E-P-014'/);
      for (const tag of REQUIRED_SCENARIO_TAGS) {
        assert.ok(content.includes(tag), `missing scenario tag ${tag}`);
      }
    });

    it('stripDataUriBase64 normalizes httpbin data-URI echo for binaryFromItem', () => {
      assert.equal(stripDataUriBase64(SAMPLE_PNG_BASE64), SAMPLE_PNG_BASE64);
      assert.equal(
        stripDataUriBase64(`data:application/octet-stream;base64,${SAMPLE_PNG_BASE64}`),
        SAMPLE_PNG_BASE64,
      );
      assert.equal(stripDataUriBase64(undefined), '');
    });
  });
}

const entryPath = fileURLToPath(import.meta.url);
if (process.argv[1]?.replace(/\\/g, '/') === entryPath.replace(/\\/g, '/')) {
  registerStructureTests();
}
