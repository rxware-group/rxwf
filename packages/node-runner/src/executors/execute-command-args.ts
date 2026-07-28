export interface ExecuteCommandArgv {
  command: string;
  argv: string[];
  /** Legacy: entire shell line stored in `command`, no argv array. */
  legacyShellLine: boolean;
}

export function normalizeExecuteCommandArgs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? ''))
    .filter((entry) => entry.trim().length > 0);
}

/** True when workflow still uses the pre-args single `command` shell line. */
export function usesLegacyExecuteCommandShellLine(
  config: Record<string, unknown>,
): boolean {
  return !Object.prototype.hasOwnProperty.call(config, 'args');
}

export function resolveExecuteCommandArgv(
  config: Record<string, unknown>,
): ExecuteCommandArgv {
  const command = String(config.command ?? '').trim();
  const argv = normalizeExecuteCommandArgs(config.args);
  const legacyShellLine =
    usesLegacyExecuteCommandShellLine(config) &&
    argv.length === 0 &&
    command.length > 0;
  return { command, argv, legacyShellLine };
}
