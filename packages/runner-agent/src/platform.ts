export type RunnerOs = 'windows' | 'linux' | 'macos';
export type RunnerArch = 'x64' | 'arm64' | 'arm';

export interface RunnerPlatform {
  os: RunnerOs;
  arch: RunnerArch;
}

export function detectPlatform(): RunnerPlatform {
  let os: RunnerOs = 'linux';
  if (process.platform === 'win32') os = 'windows';
  else if (process.platform === 'darwin') os = 'macos';

  let arch: RunnerArch = 'x64';
  if (process.arch === 'arm64') arch = 'arm64';
  else if (process.arch === 'arm') arch = 'arm';

  return { os, arch };
}
