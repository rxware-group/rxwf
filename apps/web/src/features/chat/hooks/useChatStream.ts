import { useCallback, useRef, useState } from 'react';

import {
  streamChat,
  streamChatRegenerate,
  type ChatCitation,
  type ChatProcessingPhase,
} from '../../../api/client.js';

export interface UseChatStreamOptions {
  mode?: 'chat' | 'rag';
  modelId?: string;
  fallbackToChat?: boolean;
  onDone?: (messageId: string, citations?: ChatCitation[]) => void;
  onError?: (message: string) => void;
  /** Called before regenerate stream starts (e.g. optimistic message truncation). */
  onBeforeRegenerate?: (assistantMessageId: string) => void;
}

export function useChatStream(sessionId: string | null, options: UseChatStreamOptions = {}) {
  const { mode, modelId, fallbackToChat, onDone, onError, onBeforeRegenerate } = options;
  const [streamingText, setStreamingText] = useState('');
  const [streamingPhase, setStreamingPhase] = useState<ChatProcessingPhase | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runStream = useCallback(
    async (runner: (ac: AbortController, onEvent: (ev: import('../../../api/client.js').ChatStreamEvent) => void) => Promise<void>) => {
      if (!sessionId) return;

      stop();
      const ac = new AbortController();
      abortRef.current = ac;
      setStreamingText('');
      setStreamingPhase(null);
      setIsStreaming(true);

      try {
        await runner(ac, (ev) => {
          if (ev.type === 'status') {
            setStreamingPhase(ev.phase);
          } else if (ev.type === 'token') {
            setStreamingPhase(null);
            setStreamingText((prev) => prev + ev.token);
          } else if (ev.type === 'done') {
            setStreamingText('');
            setStreamingPhase(null);
            onDone?.(ev.messageId, ev.citations);
          } else if (ev.type === 'error') {
            setStreamingPhase(null);
            onError?.(ev.message);
          }
        });
      } catch (err) {
        if (!ac.signal.aborted) {
          onError?.(err instanceof Error ? err.message : 'stream error');
        }
      } finally {
        setIsStreaming(false);
        setStreamingPhase(null);
        if (abortRef.current === ac) {
          abortRef.current = null;
        }
      }
    },
    [sessionId, onDone, onError, stop],
  );

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      await runStream((ac, onEvent) =>
        streamChat(sessionId!, content, {
          mode,
          modelId,
          fallbackToChat,
          signal: ac.signal,
          onEvent,
        }),
      );
    },
    [sessionId, mode, modelId, fallbackToChat, runStream],
  );

  const regenerate = useCallback(
    async (assistantMessageId: string) => {
      if (!assistantMessageId) return;
      onBeforeRegenerate?.(assistantMessageId);
      await runStream((ac, onEvent) =>
        streamChatRegenerate(sessionId!, assistantMessageId, {
          mode,
          modelId,
          fallbackToChat,
          signal: ac.signal,
          onEvent,
        }),
      );
    },
    [sessionId, mode, modelId, fallbackToChat, onBeforeRegenerate, runStream],
  );

  return { streamingText, streamingPhase, isStreaming, send, regenerate, stop };
}
