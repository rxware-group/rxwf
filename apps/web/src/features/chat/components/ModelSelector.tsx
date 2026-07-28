import { useEffect, useState } from 'react';

import { api, type ModelSummary } from '../../../api/client.js';
import { Select } from '../../../components/Select.js';
import { t } from '../chat-labels.js';

interface ModelSelectorProps {
  sessionId: string | null;
  modelId: string | null | undefined;
  onModelChange: (modelId: string | null) => void;
  labels?: Record<string, string>;
}

export function ModelSelector({ sessionId, modelId, onModelChange, labels }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void api.models
      .list('chat')
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  const value = modelId ?? models.find((m) => m.isDefaultChat)?.id ?? '';

  const handleChange = (nextId: string) => {
    const resolved = nextId || null;
    onModelChange(resolved);
    if (sessionId) {
      void api.patchChatSession(sessionId, { modelId: resolved });
    }
  };

  return (
    <label className="chat-model-selector">
      <span className="chat-model-selector-label">{t(labels, 'chat.model.label')}</span>
      <Select
        value={value}
        disabled={!sessionId || loading || models.length === 0}
        onChange={handleChange}
        options={
          models.length === 0
            ? [{ value: '', label: t(labels, 'chat.model.none') }]
            : models.map((m) => ({
                value: m.id,
                label: `${m.modelName}${m.isDefaultChat ? t(labels, 'chat.model.default') : ''}`,
              }))
        }
      />
    </label>
  );
}
