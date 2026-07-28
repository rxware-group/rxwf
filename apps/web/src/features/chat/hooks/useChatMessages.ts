import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../api/client.js';
import type { ChatMessage } from '../chat-types.js';

export function useChatMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    void api
      .chatMessages(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return { messages, loading, appendMessage, setMessages };
}
