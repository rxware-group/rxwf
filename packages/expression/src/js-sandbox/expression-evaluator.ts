import type { ExpressionContext } from '../types.js';
import { buildBootstrapData } from './build-globals.js';
import { evaluateViaPoolBatch } from './expression-pool.js';

export class ExpressionEvaluator {
  readonly frozenContext: ExpressionContext;

  private constructor(context: ExpressionContext) {
    this.frozenContext = context;
  }

  static async open(context: ExpressionContext): Promise<ExpressionEvaluator> {
    const nowIso = context.nowIso ?? new Date().toISOString();
    const frozen: ExpressionContext = { ...context, nowIso };
    const data = buildBootstrapData(frozen);
    return new ExpressionEvaluator({
      ...frozen,
      nowIso: data.nowIso,
      todayIso: data.todayIso,
    });
  }

  async evaluate(source: string): Promise<unknown> {
    const [result] = await this.evaluateBatch([source]);
    return result;
  }

  async evaluateBatch(sources: string[]): Promise<unknown[]> {
    if (sources.length === 0) return [];
    return evaluateViaPoolBatch(sources, this.frozenContext);
  }

  async close(): Promise<void> {
    // Worker-scoped pool slots; no main-thread release.
  }
}
