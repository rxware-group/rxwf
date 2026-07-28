export type BuiltinToolName = 'read_file' | 'grep' | 'run_terminal_cmd' | 'web_search';

export interface BuiltinToolDef {
  name: BuiltinToolName;
  description: string;
}

export function mergeBuiltinTools(opts: {
  permissions: string[];
  mode: 'off' | 'from-skill-permissions' | 'explicit';
  explicit?: BuiltinToolName[];
  webSearchEnabled?: boolean;
}): BuiltinToolDef[] {
  if (opts.mode === 'off') return [];

  const names = new Set<BuiltinToolName>();
  const perms = new Set(opts.permissions);

  if (opts.mode === 'explicit' && opts.explicit) {
    for (const t of opts.explicit) names.add(t);
  } else if (opts.mode === 'from-skill-permissions') {
    if (perms.has('filesystem:read')) {
      names.add('read_file');
      names.add('grep');
    }
    if (perms.has('code:execute')) {
      names.add('run_terminal_cmd');
    }
    if (perms.has('network') && opts.webSearchEnabled) {
      names.add('web_search');
    }
  }

  const out: BuiltinToolDef[] = [];
  if (names.has('read_file')) {
    out.push({ name: 'read_file', description: 'Read a file under workspace scan roots' });
  }
  if (names.has('grep')) {
    out.push({ name: 'grep', description: 'Search file contents with ripgrep-like grep' });
  }
  if (names.has('run_terminal_cmd')) {
    out.push({ name: 'run_terminal_cmd', description: 'Run a shell command in the skill workspace' });
  }
  if (names.has('web_search')) {
    out.push({ name: 'web_search', description: 'Search the web for up-to-date information' });
  }
  return out;
}
