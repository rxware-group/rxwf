import { describe, expect, it } from 'vitest';
import { formatIntentHints, matchToolIntents } from './skill-tool-intent-parser.js';

describe('SkillToolIntentParser', () => {
  it('matches exact tool names and Shell alias', () => {
    const matches = matchToolIntents(
      'Use Read to inspect files. Call Shell when needed.',
      [
        { name: 'read_file' },
        { name: 'run_terminal_cmd', type: 'run_terminal_cmd' },
      ],
    );
    expect(matches.some((m) => m.matchedTool === 'read_file')).toBe(true);
    expect(matches.some((m) => m.matchedTool === 'run_terminal_cmd')).toBe(true);
  });

  it('formatIntentHints returns markdown section', () => {
    const text = formatIntentHints([
      { intent: 'Read', matchedTool: 'read_file', confidence: 1, evidence: 'alias:Read' },
    ]);
    expect(text).toContain('read_file');
  });
});
