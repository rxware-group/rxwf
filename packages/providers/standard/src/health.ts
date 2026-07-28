import pg from 'pg';
import { Redis } from 'ioredis';

export interface StandardHealthResult {
  ready: boolean;
  postgres: boolean;
  redis: boolean;
}

const CONNECT_MS = 2000;

export function createStandardHealthChecker(options: {
  databaseUrl: string;
  redisUrl: string;
}) {
  return {
    async check(): Promise<StandardHealthResult> {
      let postgres = false;
      let redis = false;

      if (options.databaseUrl) {
        const pool = new pg.Pool({
          connectionString: options.databaseUrl,
          connectionTimeoutMillis: CONNECT_MS,
        });
        try {
          const res = await pool.query('SELECT 1 AS ok');
          postgres = res.rows[0]?.ok === 1;
        } catch {
          postgres = false;
        } finally {
          await pool.end().catch(() => undefined);
        }
      }

      if (options.redisUrl) {
        const client = new Redis(options.redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: CONNECT_MS,
          retryStrategy: () => null,
          lazyConnect: true,
        });
        try {
          await client.connect();
          const pong = await client.ping();
          redis = pong === 'PONG';
        } catch {
          redis = false;
        } finally {
          client.disconnect();
        }
      }

      return { ready: postgres && redis, postgres, redis };
    },
  };
}
