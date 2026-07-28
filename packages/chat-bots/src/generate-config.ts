import { z } from 'zod';
import { AwfError } from '@rxwf/shared';
import type { AiRuntime } from '@rxwf/ai-runtime-stub';
import { mergeConfig } from './config.js';
import { DEFAULT_CHAT_BOT_CONFIG, type ChatBotConfig } from './types.js';

const configPatchSchema = z
  .object({
    systemPrompt: z.string().optional(),
    openingMessage: z.string().optional(),
    themeColor: z.string().optional(),
    modelId: z.string().optional(),
    mode: z.enum(['chat', 'rag']).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
    ragTemplate: z.enum(['support', 'code']).optional(),
    fallbackToChat: z.boolean().optional(),
    accessPolicy: z.enum(['public', 'authenticated', 'role']).optional(),
  })
  .strict();

const llmResponseSchema = z.object({
  config: configPatchSchema,
  explanation: z.string().optional(),
});

export interface GenerateBotConfigResult {
  config: ChatBotConfig;
  explanation: string;
}

export async function generateBotConfigFromPrompt(
  ai: AiRuntime,
  prompt: string,
  currentDraft: ChatBotConfig,
): Promise<GenerateBotConfigResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new AwfError('E1004', 'prompt required');
  }

  const system = [
    'You configure a customer-support chat bot for rx-workflow.',
    'Reply with a single JSON object only (no markdown fences):',
    '{"config":{...partial fields...},"explanation":"short reason in Chinese"}',
    'Allowed config keys: systemPrompt, openingMessage, themeColor (hex), modelId (empty string ok),',
    'mode ("chat"|"rag"), knowledgeBaseIds (string[]), ragTemplate ("support"|"code"),',
    'fallbackToChat (boolean), accessPolicy ("public"|"authenticated"|"role").',
    `Current draft JSON: ${JSON.stringify(currentDraft)}`,
  ].join('\n');

  let raw = '';
  try {
    for await (const token of ai.chat([
      { role: 'system', content: system },
      { role: 'user', content: trimmed },
    ])) {
      raw += token;
    }
  } catch (err) {
    throw new AwfError(
      'E3010',
      err instanceof Error ? err.message : 'NL config generation failed',
    );
  }

  const jsonText = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AwfError('E3010', 'NL config generation returned invalid JSON');
  }

  const validated = llmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AwfError('E3010', 'NL config generation failed schema validation');
  }

  const config = mergeConfig(
    mergeConfig(DEFAULT_CHAT_BOT_CONFIG, currentDraft),
    validated.data.config,
  );

  return {
    config,
    explanation: validated.data.explanation?.trim() || '已根据描述更新草稿配置',
  };
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}
