const ALIASES: Record<string, string[]> = {
  CallMcpTool: ['mcp'],
  Shell: ['run_terminal_cmd', 'script'],
  Read: ['read_file'],
  Grep: ['grep'],
  'Web Search': ['web_search'],
};

export interface ToolIntentMatch {
  intent: string;
  matchedTool: string;
  confidence: number;
  evidence: string;
}

export interface WiredToolRef {
  name: string;
  type?: string;
}

export function matchToolIntents(
  skillBody: string,
  wiredTools: WiredToolRef[],
): ToolIntentMatch[] {
  const matches: ToolIntentMatch[] = [];
  const body = skillBody;
  const names = new Set(wiredTools.map((t) => t.name));

  for (const tool of wiredTools) {
    if (body.includes(tool.name)) {
      matches.push({
        intent: tool.name,
        matchedTool: tool.name,
        confidence: 1,
        evidence: `exact:${tool.name}`,
      });
    }
  }

  for (const [alias, targets] of Object.entries(ALIASES)) {
    if (!body.includes(alias)) continue;
    const hit = wiredTools.find((t) =>
      targets.some((target) => t.name === target || t.type === target),
    );
    if (hit && !matches.some((m) => m.matchedTool === hit.name)) {
      matches.push({
        intent: alias,
        matchedTool: hit.name,
        confidence: 0.85,
        evidence: `alias:${alias}`,
      });
    }
  }

  for (const m of matches) {
    if (!names.has(m.matchedTool)) {
      const idx = matches.indexOf(m);
      if (idx >= 0) matches.splice(idx, 1);
    }
  }

  return matches;
}

export function formatIntentHints(matches: ToolIntentMatch[]): string {
  if (!matches.length) return '';
  const lines = matches.map(
    (m) => `- ${m.matchedTool} (${m.intent}, confidence ${m.confidence}): ${m.evidence}`,
  );
  return `\n\n## Suggested tools from SKILL.md\n${lines.join('\n')}\n`;
}
