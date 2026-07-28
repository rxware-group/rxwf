import { getSkillBody } from '../skills/parse-skill-md.js';
import type { SkillIR } from '../types/skill-ir.js';

export function buildSkillRunSystemPrompt(input: {
  skill: SkillIR;
  intentAppendix?: string;
  ruleAppendix?: string;
  userSystemPrompt?: string;
  locale?: string;
}): string {
  const { skill } = input;
  const body = getSkillBody(skill);
  const description = skill.description.trim();
  const zh = (input.locale ?? '').toLowerCase().startsWith('zh');

  const header = zh
    ? [
        `# Skill 执行：${skill.name}`,
        skill.skillRelPath ? `路径：${skill.skillRelPath}` : '',
        description ? `说明：${description}` : '',
        '你正在执行下方定义的 Skill，而不是普通闲聊助手。请严格按 Skill 说明完成用户请求；若 Skill 需要读文件、搜索或调用工具，请使用已提供的工具。',
      ]
    : [
        `# Skill execution: ${skill.name}`,
        skill.skillRelPath ? `Path: ${skill.skillRelPath}` : '',
        description ? `Summary: ${description}` : '',
        'You are executing the Skill defined below—not a generic chat assistant. Follow the Skill instructions to fulfill the user request. Use only the tools provided when the Skill requires external actions.',
      ];

  const parts = [
    header.filter(Boolean).join('\n'),
    body,
    input.intentAppendix?.trim(),
    input.ruleAppendix?.trim(),
    input.userSystemPrompt?.trim(),
  ].filter(Boolean);

  return parts.join('\n\n');
}
