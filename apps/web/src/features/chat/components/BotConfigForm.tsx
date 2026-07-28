import type { ChatBotDraftConfig } from '../../../api/client.js';
import { FormField } from '../../../components/FormField.js';
import { Select } from '../../../components/Select.js';
import { t } from '../chat-labels.js';

export function BotConfigForm({
  draft,
  onChange,
  labels,
}: {
  draft: ChatBotDraftConfig;
  onChange: (next: ChatBotDraftConfig) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <FormField label={t(labels, 'chat.bot.form.systemPrompt')}>
        <textarea
          rows={4}
          value={draft.systemPrompt}
          onChange={(e) => onChange({ ...draft, systemPrompt: e.target.value })}
        />
      </FormField>
      <FormField label={t(labels, 'chat.bot.form.opening')}>
        <input
          type="text"
          value={draft.openingMessage}
          onChange={(e) => onChange({ ...draft, openingMessage: e.target.value })}
        />
      </FormField>
      <FormField label={t(labels, 'chat.bot.form.theme')}>
        <input
          type="color"
          value={draft.themeColor}
          onChange={(e) => onChange({ ...draft, themeColor: e.target.value })}
        />
      </FormField>
      <FormField label={t(labels, 'chat.bot.form.mode')}>
        <Select
          value={draft.mode}
          onChange={(mode) => onChange({ ...draft, mode: mode === 'rag' ? 'rag' : 'chat' })}
          options={[
            { value: 'chat', label: t(labels, 'chat.mode.chat') },
            { value: 'rag', label: t(labels, 'chat.mode.rag') },
          ]}
        />
      </FormField>
      <FormField label={t(labels, 'chat.bot.form.ragTemplate')}>
        <Select
          value={draft.ragTemplate}
          onChange={(ragTemplate) =>
            onChange({
              ...draft,
              ragTemplate: ragTemplate === 'code' ? 'code' : 'support',
            })
          }
          options={[
            { value: 'support', label: t(labels, 'chat.rag.template.support') },
            { value: 'code', label: t(labels, 'chat.rag.template.code') },
          ]}
        />
      </FormField>
      <label>
        <input
          type="checkbox"
          checked={draft.fallbackToChat}
          onChange={(e) => onChange({ ...draft, fallbackToChat: e.target.checked })}
        />{' '}
        {t(labels, 'chat.bot.form.fallback')}
      </label>
    </div>
  );
}
