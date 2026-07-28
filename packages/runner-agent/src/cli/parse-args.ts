export function getFlag(argv: string[], name: string): string | undefined {
  const flag = `--${name}`;
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) {
    return undefined;
  }
  return argv[idx + 1];
}

export function requireFlag(argv: string[], name: string, usage: string): string {
  const value = getFlag(argv, name);
  if (!value) {
    throw new Error(`Missing required flag --${name}. Usage: ${usage}`);
  }
  return value;
}
