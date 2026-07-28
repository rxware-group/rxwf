import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importCursorRules, importCursorSkill, resolveRules } from '@rxwf/skill-runtime';

describe('skill P2 rules (AC-S2 / AC-S2b)', () => {
  it('AC-S2: explicit rxwf_rules loads project rules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-ac2-'));
    mkdirSync(join(root, '.rxwf', 'rules'), { recursive: true });
    writeFileSync(join(root, '.rxwf', 'rules', 'team.md'), 'Always run tests.\n');
    const result = await resolveRules({
      ruleMode: 'explicit',
      ruleSources: ['rxwf_rules'],
      workspaceRoot: root,
    });
    expect(result.merged).toContain('run tests');
  });

  it('AC-S2b: cursor skill import then path under .rxwf/skills', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-ac2b-'));
    const cursorSkill = join(root, 'cursor-skill-src');
    mkdirSync(cursorSkill, { recursive: true });
    writeFileSync(
      join(cursorSkill, 'SKILL.md'),
      '---\nname: foo\npermissions:\n  - filesystem:read\n---\n\nDo foo.\n',
    );
    const { skillPath } = { skillPath: '' };
    const imported = await importCursorSkill({
      sourcePath: cursorSkill,
      workspaceRoot: root,
      skillName: 'foo',
      overwrite: true,
    });
    expect(imported.skillRelPath).toBe('foo');
    const pkg = join(root, '.rxwf', 'skills', 'foo', 'SKILL.md');
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(pkg, 'utf8')).toContain('Do foo');
    void skillPath;
  });

  it('imports cursor rules into .rxwf/rules/imported/cursor', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-rules-import-'));
    const src = join(root, 'cursor-rules');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'style.mdc'), 'Use tabs.\n');
    const result = await importCursorRules({
      sourcePath: src,
      workspaceRoot: root,
      overwrite: true,
    });
    expect(result.imported).toBe(1);
    expect(result.targetDir).toContain('imported');
  });
});
