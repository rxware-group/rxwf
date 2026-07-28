import { describe, expect, it } from 'vitest';
import { generateBotConfigFromPrompt } from './generate-config.js';
import { DEFAULT_CHAT_BOT_CONFIG } from './types.js';

describe('generateBotConfigFromPrompt', () => {
  it('parses JSON config from model output', async () => {
    const ai = {
      async *chat() {
        yield '{"config":{"systemPrompt":"客服助手","mode":"rag"},"explanation":"已配置 RAG"}';
      },
      async runAgent() {
        return { items: [] };
      },
    };

    const result = await generateBotConfigFromPrompt(
      ai,
      '做一个技术支持机器人',
      DEFAULT_CHAT_BOT_CONFIG,
    );
    expect(result.config.systemPrompt).toBe('客服助手');
    expect(result.config.mode).toBe('rag');
    expect(result.explanation).toContain('RAG');
  });

  it('throws E3010 on invalid JSON', async () => {
    const ai = {
      async *chat() {
        yield 'not json';
      },
      async runAgent() {
        return { items: [] };
      },
    };

    await expect(
      generateBotConfigFromPrompt(ai, 'test', DEFAULT_CHAT_BOT_CONFIG),
    ).rejects.toMatchObject({ code: 'E3010' });
  });
});
