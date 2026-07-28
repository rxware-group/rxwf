import { describe, expect, it } from 'vitest';
import { resolveFixedCapabilityToolAgentDescription } from './fixed-capability-tool-descriptions.js';

describe('resolveFixedCapabilityToolAgentDescription', () => {
  it('resolves zh-CN and en-US agent descriptions', () => {
    expect(resolveFixedCapabilityToolAgentDescription('toolRead', {}, 'zh-CN')).toBe(
      '按路径读取工作区内的文本文件。',
    );
    expect(resolveFixedCapabilityToolAgentDescription('toolRead', {}, 'en-US')).toBe(
      'Read a text file from the workspace by path.',
    );
  });
});
