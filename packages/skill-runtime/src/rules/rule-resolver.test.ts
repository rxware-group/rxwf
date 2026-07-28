import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRules, assertAllowedRuleSources } from './rule-resolver.js';

describe('RuleResolver', () => {
  it('returns empty when ruleMode is off', async () => {
    const result = await resolveRules({
      ruleMode: 'off',
      workspaceRoot: '/tmp',
    });
    expect(result.merged).toBe('');
    expect(result.contexts).toHaveLength(0);
  });

  it('loads .rxwf/rules markdown (AC-S2)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-rules-'));
    const rulesDir = join(root, '.rxwf', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'style.md'), '# Use TypeScript\n');
    const result = await resolveRules({
      ruleMode: 'explicit',
      ruleSources: ['rxwf_rules'],
      workspaceRoot: root,
    });
    expect(result.merged).toContain('TypeScript');
    expect(result.contexts.length).toBeGreaterThan(0);
  });

  it('rejects cursor_rules with E1069', () => {
    expect(() => assertAllowedRuleSources(['cursor_rules'])).toThrowError(
      expect.objectContaining({ code: 'E1069' }),
    );
  });
});
