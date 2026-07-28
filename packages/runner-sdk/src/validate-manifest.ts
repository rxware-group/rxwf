import type { RunnerExtensionManifest } from './manifest.js';

export type ValidateExtensionManifestResult =
  | { ok: true }
  | { ok: false; reason: string };

function parseMajor(version: string): number | null {
  const match = /^(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function parseRangeMajor(range: string): number | null {
  const trimmed = range.trim();
  const versionPart = trimmed.replace(/^[\^~>=<]+/, '');
  return parseMajor(versionPart);
}

export function validateExtensionManifest(
  manifest: RunnerExtensionManifest,
  sdkVersion: string,
): ValidateExtensionManifestResult {
  if (!manifest.runnerSdk || manifest.runnerSdk.trim() === '') {
    return { ok: false, reason: 'manifest.runnerSdk is required' };
  }

  const sdkMajor = parseMajor(sdkVersion);
  if (sdkMajor === null) {
    return { ok: false, reason: `invalid sdk version: ${sdkVersion}` };
  }

  const rangeMajor = parseRangeMajor(manifest.runnerSdk);
  if (rangeMajor === null) {
    return { ok: false, reason: `invalid runnerSdk range: ${manifest.runnerSdk}` };
  }

  if (sdkMajor !== rangeMajor) {
    return {
      ok: false,
      reason: `runnerSdk ${manifest.runnerSdk} is incompatible with sdk ${sdkVersion}`,
    };
  }

  return { ok: true };
}
