import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  E2E_TRACKS,
  assertRequiredTrackProjects,
  buildE2eProjects,
  resolveE2eTrack,
} from './playwright.config.js';

const e2eDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e');

describe('resolveE2eTrack', () => {
  it('accepts lite, standard, and plus', () => {
    expect(resolveE2eTrack('lite')).toBe('lite');
    expect(resolveE2eTrack('standard')).toBe('standard');
    expect(resolveE2eTrack('plus')).toBe('plus');
  });

  it('defaults to lite when unset', () => {
    expect(resolveE2eTrack()).toBe('lite');
  });

  it('rejects unknown track', () => {
    expect(() => resolveE2eTrack('docker')).toThrow(/RXWF_E2E_TRACK/i);
  });
});

describe('buildE2eProjects', () => {
  it('缺少 standard/plus project 定义应失败', () => {
    expect(() =>
      assertRequiredTrackProjects([{ name: 'lite-setup' }, { name: 'lite-chromium' }]),
    ).toThrow(/standard/i);
    expect(() =>
      assertRequiredTrackProjects([
        { name: 'lite-chromium' },
        { name: 'standard-chromium' },
        { name: 'plus-chromium' },
      ]),
    ).not.toThrow();
  });

  it('defines distinguishable lite, standard, and plus browser projects', () => {
    const projects = buildE2eProjects({ e2eDir });
    assertRequiredTrackProjects(projects);

    for (const track of E2E_TRACKS) {
      const browser = projects.find((project) => project.name === `${track}-chromium`);
      expect(browser, `${track}-chromium`).toBeDefined();
      expect(browser?.metadata).toEqual({ track });
    }
  });

  it('filters projects when trackFilter is set', () => {
    const projects = buildE2eProjects({ e2eDir, trackFilter: 'standard' });
    expect(projects.map((project) => project.name)).toEqual([
      'standard-setup',
      'standard-chromium',
    ]);
  });
});
