#!/usr/bin/env node
/**
 * AC-053 / T-112: E2E coverage matrix — M-5 Binary row 100% gate.
 * Run: node docs/test/e2e-coverage-matrix.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMatrixTable } from '../../scripts/validate-e2e-matrix.mjs';
import { assertM5BinaryImplementationAllowed } from '../architecture/binary-current-state.test.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MATRIX_PATH = join(root, 'docs/test/e2e-coverage-matrix.md');
const BINARY_SPEC_PATH = join(root, 'apps/web/e2e/binary-full-chain.spec.ts');

/** Platform rows related to M-5 Binary (AC-053). */
export const BINARY_MATRIX_ROW_IDS = ['E2E-P-014'];

/**
 * @param {string} [matrixPath]
 */
export function validateBinaryMatrixRows(matrixPath = MATRIX_PATH) {
  const errors = [];
  if (!existsSync(matrixPath)) {
    return { ok: false, errors: [`missing matrix file: ${matrixPath}`] };
  }

  const content = readFileSync(matrixPath, 'utf8');
  const { rows } = parseMatrixTable(content);
  const rowById = new Map(rows.map((row) => [row.row_id, row]));

  for (const rowId of BINARY_MATRIX_ROW_IDS) {
    const row = rowById.get(rowId);
    if (!row) {
      errors.push(`missing Binary matrix row: ${rowId}`);
      continue;
    }
    if (row.status !== 'covered') {
      errors.push(`${rowId}: status must be covered (AC-053), got "${row.status}"`);
    }
    if (!row.e2e_spec || !row.e2e_spec.includes('binary-full-chain.spec.ts')) {
      errors.push(
        `${rowId}: e2e_spec must reference binary-full-chain.spec.ts, got "${row.e2e_spec}"`,
      );
    }
    if (row.track !== 'standard') {
      errors.push(`${rowId}: track must be standard, got "${row.track}"`);
    }
    if (!row.spec_fr.includes('Binary')) {
      errors.push(`${rowId}: spec_fr must reference Binary / M-5 Binary`);
    }
  }

  if (!existsSync(BINARY_SPEC_PATH)) {
    errors.push(`missing E2E spec: apps/web/e2e/binary-full-chain.spec.ts`);
  } else {
    const specContent = readFileSync(BINARY_SPEC_PATH, 'utf8');
    if (!/export const BINARY_FULL_CHAIN_E2E_GREEN = true;/.test(specContent)) {
      errors.push(
        'binary-full-chain.spec.ts: BINARY_FULL_CHAIN_E2E_GREEN must be true after T-111 Green',
      );
    }
    if (!specContent.includes("MATRIX_ROW_ID = 'E2E-P-014'")) {
      errors.push('binary-full-chain.spec.ts: must map MATRIX_ROW_ID to E2E-P-014');
    }
  }

  return { ok: errors.length === 0, errors };
}

test('B-6: binary matrix tests allowed after plan confirmation', () => {
  assert.doesNotThrow(() => assertM5BinaryImplementationAllowed());
});

test('AC-053 / T-112: Binary matrix rows 100% covered', () => {
  const result = validateBinaryMatrixRows();
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('AC-053 / T-112: E2E-P-014 spec file on disk', () => {
  assert.ok(existsSync(BINARY_SPEC_PATH), 'binary-full-chain.spec.ts must exist');
});
