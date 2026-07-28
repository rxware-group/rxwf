import type { FastifyInstance } from 'fastify';
import type { RuntimeConfig } from '@rxwf/system-settings';
import { config, envDefaults } from '../config.js';

export function registerSystemRoutes(
  app: FastifyInstance,
  _db?: unknown,
  getRuntimeConfig?: () => Promise<RuntimeConfig>,
): void {
  app.get('/api/system/features', async () => {
    const runtime = getRuntimeConfig
      ? await getRuntimeConfig()
      : { publicUrl: envDefaults.publicUrl };
    return {
      deployProfile: config.deployProfile,
      featurePlus: config.featurePlus,
      httpPort: config.httpPort,
      publicUrl: runtime.publicUrl,
      version: '1.0.0-core',
    };
  });
}
