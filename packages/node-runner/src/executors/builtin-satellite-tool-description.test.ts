import { describe, expect, it } from 'vitest';

import { resolveSatelliteToolDescription } from './builtin-satellite-tool-description.js';



describe('resolveSatelliteToolDescription', () => {

  it('returns localized built-in description for fixed tool types', () => {

    expect(resolveSatelliteToolDescription('toolRead', {}, 'zh-CN')).toContain('读取');

    expect(resolveSatelliteToolDescription('toolRead', {}, 'en-US')).toContain('Read a text file');

    expect(resolveSatelliteToolDescription('toolWrite', {}, 'en-US')).toContain('Write or append');

    expect(resolveSatelliteToolDescription('toolGrep', {}, 'en-US')).toContain('Search file contents');

    expect(resolveSatelliteToolDescription('toolShell', {}, 'en-US')).toContain('shell command');

    expect(resolveSatelliteToolDescription('toolWebSearch', {}, 'en-US')).toContain('Search the web');

  });



  it('defaults to zh-CN when locale is omitted', () => {

    expect(resolveSatelliteToolDescription('toolRead', {})).toContain('读取');

  });



  it('prefers custom toolDescription when provided', () => {

    expect(

      resolveSatelliteToolDescription('toolRead', {

        toolDescription: 'Read config files only',

      }),

    ).toBe('Read config files only');

  });



  it('returns empty for types without a built-in default', () => {

    expect(resolveSatelliteToolDescription('toolMcp', {})).toBe('');

  });

});

