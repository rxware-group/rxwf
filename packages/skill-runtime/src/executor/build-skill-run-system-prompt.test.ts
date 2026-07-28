import { describe, expect, it } from 'vitest';
import { buildSkillRunSystemPrompt } from './build-skill-run-system-prompt.js';
import type { SkillIR } from '../types/skill-ir.js';

const baseSkill: SkillIR = {
  id: 'hello',
  name: 'hello',
  description: 'Minimal hello skill.',
  skillRelPath: '.rxwf/skills/hello',
  packageDir: '/ws/.rxwf/skills/hello',
  permissions: ['filesystem:read'],
  body: 'Say hello briefly.',
};

describe('buildSkillRunSystemPrompt', () => {
  it('prepends skill execution context before body', () => {
    const text = buildSkillRunSystemPrompt({ skill: baseSkill, locale: 'en-US' });
    expect(text).toContain('# Skill execution: hello');
    expect(text).toContain('Path: .rxwf/skills/hello');
    expect(text).toContain('Summary: Minimal hello skill.');
    expect(text).toContain('You are executing the Skill defined below');
    expect(text).toContain('Say hello briefly.');
    expect(text.indexOf('# Skill execution')).toBeLessThan(text.indexOf('Say hello briefly.'));
  });

  it('uses Chinese preamble for zh locale', () => {
    const text = buildSkillRunSystemPrompt({ skill: baseSkill, locale: 'zh-CN' });
    expect(text).toContain('# Skill 执行：hello');
    expect(text).toContain('你正在执行下方定义的 Skill');
  });

  it('appends intent, rules, and user system prompt after body', () => {
    const text = buildSkillRunSystemPrompt({
      skill: baseSkill,
      intentAppendix: '## Tool hints',
      ruleAppendix: '## Rules',
      userSystemPrompt: 'Reply in JSON.',
      locale: 'en-US',
    });
    expect(text).toMatch(/Say hello briefly\.\n\n## Tool hints\n\n## Rules\n\nReply in JSON\./);
  });
});
