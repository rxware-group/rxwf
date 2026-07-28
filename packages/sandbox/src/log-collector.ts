export type SandboxLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SandboxLogEntry {
  level: SandboxLogLevel;
  message: string;
  timestamp: string;
}

export function createLogCollector(opts: {
  maxEntries: number;
  maxMessageLen: number;
}) {
  const entries: SandboxLogEntry[] = [];
  const push = (level: SandboxLogLevel, raw: unknown) => {
    if (entries.length >= opts.maxEntries) return;
    const message = String(raw).slice(0, opts.maxMessageLen);
    entries.push({
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  };
  return {
    debug: (m: unknown) => push('debug', m),
    info: (m: unknown) => push('info', m),
    warn: (m: unknown) => push('warn', m),
    error: (m: unknown) => push('error', m),
    entries: () => entries,
  };
}
