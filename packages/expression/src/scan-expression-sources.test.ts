import { describe, it, expect } from 'vitest';
import {
  scanExpressionSources,
  validateWorkflowExpressionSources,
} from './scan-expression-sources.js';

describe('scanExpressionSources', () => {
  it('finds embedded and expression-mode sources', () => {
    const targets = scanExpressionSources([
      {
        id: 'n1',
        name: 'HTTP',
        parameters: {
          url: '{{ $env.API_URL }}/{{ $json.id }}',
          condition: '{{ $json.ok }}',
        },
      },
    ]);
    expect(targets.map((t) => t.fieldPath).sort()).toEqual(['condition', 'url', 'url']);
  });

  it('flags forbidden syntax', () => {
    const issues = validateWorkflowExpressionSources([
      {
        id: 'n1',
        name: 'Bad',
        parameters: { code: '{{ process.exit() }}' },
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBe('n1');
  });
});
