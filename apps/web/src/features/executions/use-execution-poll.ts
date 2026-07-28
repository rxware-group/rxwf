import { useEffect, useState } from 'react';
import { api, type ExecutionDetail } from '../../api/client.js';
import { isTerminalExecutionStatus } from './execution-poll-utils.js';

export function useExecutionPoll(
  executionId: string | undefined,
  enabled: boolean,
  intervalMs = 2000,
): ExecutionDetail | null {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    if (!executionId || !enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const d = await api.executions.get(executionId);
        if (cancelled) return;
        setDetail(d);
        if (isTerminalExecutionStatus(d.status)) {
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    timer = setTimeout(tick, 0);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [executionId, enabled, intervalMs]);

  return detail;
}
