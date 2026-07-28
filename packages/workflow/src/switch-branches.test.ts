import { describe, expect, it } from 'vitest';
import {
  createSwitchBranch,
  defaultSwitchParameters,
  parseSwitchBranches,
  switchBranchIndex,
} from './switch-branches.js';

describe('switch-branches', () => {
  it('parses branch rows with stable ids', () => {
    const branches = parseSwitchBranches({
      branches: [
        { id: 'a', label: 'Paid', condition: '{{ $json.ok }}' },
        { id: 'b', label: '', condition: '{{ false }}' },
      ],
    });
    expect(branches).toEqual([
      { id: 'a', label: 'Paid', condition: '{{ $json.ok }}' },
      { id: 'b', label: '端口2', condition: '{{ false }}' },
    ]);
  });

  it('maps handle id and outputIndex to branch index', () => {
    const params = defaultSwitchParameters();
    const id = parseSwitchBranches(params)[0]!.id;
    expect(switchBranchIndex(params, id)).toBe(0);
    expect(switchBranchIndex(params, id, 99)).toBe(0);
  });

  it('createSwitchBranch uses 1-based default labels', () => {
    expect(createSwitchBranch(2).label).toBe('端口3');
  });
});
