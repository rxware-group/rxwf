import { describe, expect, it } from 'vitest';
import {
  buildDockerRunArgs,
  buildLaunchFromServer,
  validateDockerConfig,
  validateDockerTransport,
  validateDockerVolume,
} from './launch.js';

describe('buildDockerRunArgs', () => {
  it('builds stdio docker run with env, volumes, network and image args', () => {
    const args = buildDockerRunArgs({
      image: 'mcp/filesystem:latest',
      args: ['--stdio'],
      volumes: ['/data:/data:ro'],
      env: { TOKEN: 'secret' },
      network: 'bridge',
    });
    expect(args).toEqual([
      'run',
      '-i',
      '--rm',
      '--network',
      'bridge',
      '-e',
      'TOKEN=secret',
      '-v',
      '/data:/data:ro',
      'mcp/filesystem:latest',
      '--stdio',
    ]);
  });

  it('rejects docker.sock volume mounts', () => {
    expect(() => validateDockerVolume('/var/run/docker.sock:/var/run/docker.sock')).toThrow(
      /docker\.sock/,
    );
  });

  it('rejects privileged flag in docker args', () => {
    expect(() =>
      validateDockerConfig({ image: 'x', args: ['--privileged'] }),
    ).toThrow(/privileged/);
  });

  it('allows gateway config without image', () => {
    expect(() =>
      validateDockerConfig({
        args: ['mcp', 'gateway', 'run', '--profile', 'default'],
        env: { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' },
      }),
    ).not.toThrow();
  });
});

describe('buildLaunchFromServer', () => {
  it('maps docker transport to docker run when image is set', () => {
    const launch = buildLaunchFromServer({
      transport: 'docker',
      docker: { image: 'mcp/demo:1', args: ['serve'] },
    });
    expect(launch).toEqual({
      command: 'docker',
      args: ['run', '-i', '--rm', 'mcp/demo:1', 'serve'],
    });
  });

  it('maps docker gateway CLI without image (Cursor mcp.json style)', () => {
    const launch = buildLaunchFromServer({
      transport: 'docker',
      command: 'docker',
      args: ['mcp', 'gateway', 'run', '--profile', 'default'],
      docker: {
        env: {
          LOCALAPPDATA: 'C:\\Users\\zdw-m\\AppData\\Local',
          ProgramData: 'C:\\ProgramData',
        },
      },
    });
    expect(launch).toEqual({
      command: 'docker',
      args: ['mcp', 'gateway', 'run', '--profile', 'default'],
      env: {
        LOCALAPPDATA: 'C:\\Users\\zdw-m\\AppData\\Local',
        ProgramData: 'C:\\ProgramData',
      },
    });
  });

  it('validateDockerTransport accepts gateway-only config', () => {
    expect(() =>
      validateDockerTransport({
        command: 'docker',
        args: ['mcp', 'gateway', 'run'],
        docker: { env: { FOO: 'bar' } },
      }),
    ).not.toThrow();
  });
});
