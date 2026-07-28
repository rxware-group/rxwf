import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ExecutorRegistry, NodeExecutor } from '@rxwf/node-runner';
import { AwfError } from '@rxwf/shared';

export interface PluginManifest {
  type: string;
  version: number;
  handler: string;
}

interface StoredPlugin {
  id: string;
  type: string;
  enabled: boolean;
  manifestJson: string;
  signature: string;
}

function buildExecutor(manifest: PluginManifest): NodeExecutor {
  return {
    type: manifest.type,
    async execute(ctx) {
      return {
        status: 'success',
        outputItems: [
          [
            {
              json: {
                plugin: manifest.type,
                handler: manifest.handler,
                input: ctx.config,
              },
            },
          ],
        ],
      };
    },
  };
}

export function createPluginHost(deps: {
  registry: ExecutorRegistry;
  signingSecret: string;
}) {
  const plugins = new Map<string, StoredPlugin>();

  function verify(manifest: string, signature: string): void {
    const expected = createHmac('sha256', deps.signingSecret).update(manifest).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AwfError('E3020', 'Invalid plugin signature');
    }
  }

  function registerExecutor(manifest: PluginManifest, enabled: boolean): void {
    if (enabled) {
      deps.registry.register(buildExecutor(manifest));
      return;
    }
    deps.registry.register({
      type: manifest.type,
      async execute() {
        throw new AwfError('E3021', 'Plugin is disabled');
      },
    });
  }

  return {
    registerFromManifest(manifestJson: string, signature: string): { id: string; type: string } {
      verify(manifestJson, signature);
      const manifest = JSON.parse(manifestJson) as PluginManifest;
      const id = crypto.randomUUID();
      plugins.set(id, {
        id,
        type: manifest.type,
        enabled: true,
        manifestJson,
        signature,
      });
      registerExecutor(manifest, true);
      return { id, type: manifest.type };
    },

    list(): Array<{ id: string; type: string; enabled: boolean; version: number }> {
      return [...plugins.values()].map((p) => {
        const manifest = JSON.parse(p.manifestJson) as PluginManifest;
        return {
          id: p.id,
          type: p.type,
          enabled: p.enabled,
          version: manifest.version,
        };
      });
    },

    enable(id: string): void {
      const p = plugins.get(id);
      if (!p) throw new AwfError('E1001', 'Plugin not found');
      p.enabled = true;
      registerExecutor(JSON.parse(p.manifestJson) as PluginManifest, true);
    },

    disable(id: string): void {
      const p = plugins.get(id);
      if (!p) throw new AwfError('E1001', 'Plugin not found');
      p.enabled = false;
      registerExecutor(JSON.parse(p.manifestJson) as PluginManifest, false);
    },
  };
}
