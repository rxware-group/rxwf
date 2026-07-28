import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { createExecutorRegistry } from '@rxwf/node-runner';
import { createPluginHost } from './host.js';

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('createPluginHost', () => {
  it('registers plugin executor after valid signature (AC-26)', () => {
    const registry = createExecutorRegistry();
    const secret = 'plugin-secret';
    const host = createPluginHost({ registry, signingSecret: secret });
    const manifest = JSON.stringify({
      type: 'demoPlugin',
      version: 1,
      handler: 'echo',
    });
    const signature = sign(manifest, secret);
    host.registerFromManifest(manifest, signature);
    expect(registry.has('demoPlugin')).toBe(true);
  });

  it('can disable and re-enable plugin', () => {
    const registry = createExecutorRegistry();
    const secret = 'plugin-secret';
    const host = createPluginHost({ registry, signingSecret: secret });
    const manifest = JSON.stringify({
      type: 'togglePlugin',
      version: 1,
      handler: 'echo',
    });
    const signature = sign(manifest, secret);
    const { id } = host.registerFromManifest(manifest, signature);
    host.disable(id);
    host.enable(id);
    expect(host.list().find((p) => p.id === id)?.enabled).toBe(true);
  });

  it('rejects invalid signature (AC-27)', () => {
    const registry = createExecutorRegistry();
    const host = createPluginHost({ registry, signingSecret: 'secret' });
    expect(() => host.registerFromManifest('{}', 'bad-sig')).toThrow(/E3020|Invalid plugin signature/);
  });
});
