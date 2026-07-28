import { describe, expect, it } from 'vitest';
import type { Location } from 'react-router-dom';
import {
  getSettingsBackground,
  settingsCloseTarget,
  settingsModalState,
} from './settings-location-state.js';

const editorLocation = {
  pathname: '/workflows/wf-1',
  search: '',
  hash: '',
  state: null,
  key: 'abc',
} satisfies Location;

describe('settings-location-state', () => {
  it('reads background from router state', () => {
    expect(
      getSettingsBackground({ background: editorLocation }),
    ).toEqual(editorLocation);
  });

  it('returns undefined for invalid state', () => {
    expect(getSettingsBackground(null)).toBeUndefined();
    expect(getSettingsBackground({ background: { pathname: 1 } })).toBeUndefined();
  });

  it('builds modal state from location', () => {
    expect(settingsModalState(editorLocation)).toEqual({
      background: editorLocation,
    });
    expect(settingsModalState(undefined)).toBeUndefined();
  });

  it('resolves close target from background', () => {
    expect(
      settingsCloseTarget({ background: editorLocation }),
    ).toEqual({
      pathname: '/workflows/wf-1',
      search: '',
      hash: '',
      state: null,
    });
  });

  it('falls back to from path for legacy state', () => {
    expect(settingsCloseTarget({ from: '/workflows/wf-2' })).toEqual({
      pathname: '/workflows/wf-2',
      search: '',
      hash: '',
      state: null,
    });
  });
});
