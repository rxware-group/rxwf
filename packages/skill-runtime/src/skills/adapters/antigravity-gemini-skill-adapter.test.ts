import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importAntigravityGeminiSkill } from './antigravity-gemini-skill-adapter.js';

describe('importAntigravityGeminiSkill', () => {
  it('imports from explicit sourcePath into .rxwf/skills', async () => {
    const geminiRoot = mkdtempSync(join(tmpdir(), 'rxwf-gemini-skills-'));
    const pkg = join(geminiRoot, 'demo-skill');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'SKILL.md'), '---\nname: demo\n---\n\nDemo.\n');

    const workspace = mkdtempSync(join(tmpdir(), 'rxwf-ws-'));
    const result = await importAntigravityGeminiSkill({
      workspaceRoot: workspace,
      sourcePath: geminiRoot,
      skillName: 'demo-skill',
      overwrite: true,
    });
    expect(result.skillRelPath).toBe('demo-skill');
    const dest = join(workspace, '.rxwf', 'skills', 'demo-skill', 'SKILL.md');
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(dest, 'utf8')).toContain('Demo');
  });
});
