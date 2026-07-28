export class AwfError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AwfError";
  }
}

/** Flatten Error / AwfError cause chains for debug UI and telemetry. */
export function formatErrorDetail(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current != null && depth < 6; depth++) {
    if (current instanceof AwfError) {
      parts.push(`[${current.code}] ${current.message}`);
    } else if (current instanceof Error) {
      parts.push(current.message);
    } else {
      parts.push(String(current));
    }
    current =
      current instanceof Error
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }
  return parts.filter((part) => part.trim().length > 0).join('\nCaused by: ');
}
