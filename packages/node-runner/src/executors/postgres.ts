import pg from 'pg';
import type { WorkflowItem } from '@rxwf/shared';
import type { NodeExecutor } from '../types/node-executor.js';
import {
  expressionMetaFromNodeContext,
} from '../expression/item-context.js';
import { resolveItemConfigStringField } from '../expression/resolve-config-string-field.js';

export interface PostgresExecutorDeps {
  /** Fallback when config.connectionString and RXWF_DATABASE_URL are unset */
  databaseUrl?: string;
}

const DEFAULT_QUERY = 'SELECT 1';

function resolveDatabaseUrl(
  config: Record<string, unknown>,
  deps: PostgresExecutorDeps,
): string {
  const fromConfig = String(config.connectionString ?? '').trim();
  if (fromConfig) return fromConfig;
  const fromDeps = String(deps.databaseUrl ?? '').trim();
  if (fromDeps) return fromDeps;
  return String(process.env.RXWF_DATABASE_URL ?? '').trim();
}

async function resolveQueryForItem(
  config: Record<string, unknown>,
  itemJson: Record<string, unknown>,
  inputItems: WorkflowItem[],
  itemIndex: number,
  ctx: Parameters<NodeExecutor['execute']>[0],
): Promise<string> {
  const raw = config.query == null || config.query === ''
    ? DEFAULT_QUERY
    : String(config.query);
  return resolveItemConfigStringField(
    config,
    'query',
    raw,
    itemJson,
    inputItems,
    ctx.env,
    ctx.nodes,
    ctx.vars,
    itemIndex,
    expressionMetaFromNodeContext(ctx),
  ).then((q) => q.trim());
}

export function createPostgresExecutor(
  deps: PostgresExecutorDeps = {},
): NodeExecutor {
  return {
    type: 'postgres',
    async execute(ctx) {
      const connectionString = resolveDatabaseUrl(ctx.config, deps);
      if (!connectionString) {
        return {
          status: 'failed',
          errorCode: 'E2003',
          errorMessage: 'PostgreSQL connection not configured (set RXWF_DATABASE_URL or connectionString)',
        };
      }

      const explicitBlankQuery =
        ctx.config.query != null &&
        String(ctx.config.query).trim() === '' &&
        String(ctx.config.query).length > 0;

      if (explicitBlankQuery) {
        return {
          status: 'failed',
          errorCode: 'E2002',
          errorMessage: 'postgres query must not be blank',
        };
      }

      const items = ctx.inputItems.length ? ctx.inputItems : [{ json: {} }];
      const pool = new pg.Pool({
        connectionString,
        connectionTimeoutMillis: 5000,
      });

      try {
        const output: WorkflowItem[] = [];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i]!;
          const query = await resolveQueryForItem(
            ctx.config,
            item.json,
            items,
            i,
            ctx,
          );
          if (!query) {
            return {
              status: 'failed',
              errorCode: 'E2002',
              errorMessage: 'postgres query must not be blank',
            };
          }
          const result = await pool.query(query);
          output.push({
            json: {
              query,
              rows: result.rows,
              rowCount: result.rowCount ?? result.rows.length,
            },
            binary: item.binary,
          });
        }
        return {
          status: 'success',
          outputItems: [output],
        };
      } catch (err) {
        return {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      } finally {
        await pool.end().catch(() => undefined);
      }
    },
  };
}

export const postgresExecutor = createPostgresExecutor();
