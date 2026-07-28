import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { RunnerToolInvokeRequest } from '@rxwf/runner-protocol';
import { handleSkillToolInvoke } from './skill-tool-handler.js';

function baseRequest(
  overrides: Partial<RunnerToolInvokeRequest> & Pick<RunnerToolInvokeRequest, 'method' | 'args'>,
): RunnerToolInvokeRequest {
  return {
    invokeId: 'inv-1',
    executionId: 'exec-1',
    nodeRunId: 'node-1',
    capability: 'skill:filesystem',
    scanRoots: [],
    timeoutMs: 60_000,
    ...overrides,
  };
}

describe('handleSkillToolInvoke filesystem', () => {
  it('writes file within scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const target = join(tmp, 'a.txt');
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'write',
        args: { path: target, content: 'hello' },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('success');
    await expect(readFile(target, 'utf8')).resolves.toBe('hello');
  });

  it('rejects write outside scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const outside = join(tmpdir(), 'rxwf-outside-write.txt');
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'write',
        args: { path: outside, content: 'nope' },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1056');
    expect(res.errorMessage).toContain(tmp);
    expect(res.errorMessage).toContain(outside);
  });

  it('reads file within scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const target = join(tmp, 'read.txt');
    await writeFile(target, 'content', 'utf8');
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'read',
        args: { path: target },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('success');
    expect(res.result).toBe('content');
  });

  it('grep finds matches within scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    await writeFile(join(tmp, 'one.txt'), 'alpha\nbeta needle\n', 'utf8');
    await writeFile(join(tmp, 'two.txt'), 'no match\n', 'utf8');
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'grep',
        args: { pattern: 'needle', path: tmp },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('success');
    const result = res.result as { matches: Array<{ path: string; text: string }> };
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.text).toContain('needle');
  });

  it('grep rejects path outside scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'grep',
        args: { pattern: 'x', path: tmpdir() },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1056');
    expect(res.errorMessage).toContain(tmp);
  });
});

describe('handleSkillToolInvoke shell', () => {
  it('executes command within scanRoots cwd', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const command = process.platform === 'win32' ? 'echo hello-shell' : 'echo hello-shell';
    const res = await handleSkillToolInvoke(
      baseRequest({
        capability: 'shell',
        method: 'exec',
        args: { command, cwd: tmp },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('success');
    const result = res.result as { stdout: string; exitCode: number };
    expect(result.stdout).toContain('hello-shell');
    expect(result.exitCode).toBe(0);
  });

  it('rejects blacklisted shell command', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const res = await handleSkillToolInvoke(
      baseRequest({
        capability: 'shell',
        method: 'exec',
        args: { command: 'rm -rf /', cwd: tmp },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1058');
  });

  it('rejects cwd outside scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const res = await handleSkillToolInvoke(
      baseRequest({
        capability: 'shell',
        method: 'exec',
        args: { command: 'echo x', cwd: tmpdir() },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('failed');
    expect(res.errorCode).toBe('E1056');
  });
});

describe('handleSkillToolInvoke resolveWorkspace', () => {
  it('finds workspace root via .rxwf/skills', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-skill-tool-'));
    const skillsDir = join(tmp, '.rxwf', 'skills');
    await mkdir(skillsDir, { recursive: true });
    const res = await handleSkillToolInvoke(
      baseRequest({
        method: 'resolveWorkspace',
        args: { startDir: skillsDir },
        scanRoots: [tmp],
      }),
    );
    expect(res.status).toBe('success');
    expect(res.result).toBe(tmp);
  });
});

describe('handleSkillToolInvoke admin:filesystem list', () => {
  it('lists directory without scanRoots', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'rxwf-admin-fs-'));
    await mkdir(join(tmp, 'subdir'), { recursive: true });
    const res = await handleSkillToolInvoke({
      invokeId: 'inv-1',
      executionId: 'ex-1',
      nodeRunId: 'nr-1',
      capability: 'admin:filesystem',
      method: 'list',
      args: { path: tmp, dirsOnly: true },
      timeoutMs: 5000,
    });
    expect(res.status).toBe('success');
    const body = res.result as {
      entries: Array<{ name: string; kind: string }>;
    };
    expect(body.entries.some((e) => e.name === 'subdir' && e.kind === 'directory')).toBe(
      true,
    );
  });
});
