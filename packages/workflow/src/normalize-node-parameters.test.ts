import { describe, expect, it } from 'vitest';
import { normalizeNodeParameters } from './normalize-node-parameters.js';

describe('normalizeNodeParameters', () => {
  it('wraps bare expression mode value in {{ }}', () => {
    const node = {
      id: '1',
      name: 'N',
      type: 'httpRequest',
      parameters: {
        url: '$json.id',
        _fieldModes: { url: 'expression' },
      },
    };
    const out = normalizeNodeParameters(node);
    expect(out.parameters.url).toBe('{{ $json.id }}');
    expect(out.parameters._fieldModes).toBeUndefined();
  });

  it('is idempotent for already-wrapped templates', () => {
    const node = {
      id: '1',
      name: 'N',
      type: 'httpRequest',
      parameters: { url: '{{ $json.id }}' },
    };
    expect(normalizeNodeParameters(node).parameters.url).toBe('{{ $json.id }}');
  });

  it('wraps IF condition bare expressions', () => {
    const node = {
      id: '1',
      name: 'IF',
      type: 'if',
      parameters: {
        condition: '$json.active === true',
        _fieldModes: { condition: 'expression' },
      },
    };
    const out = normalizeNodeParameters(node);
    expect(out.parameters.condition).toBe('{{ $json.active === true }}');
  });
});
