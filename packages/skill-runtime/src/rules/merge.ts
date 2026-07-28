import type { InstructionContextIR } from './instruction-context-ir.js';

/** Rough token estimate: chars / 4 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function mergeInstructionContexts(
  contexts: InstructionContextIR[],
  maxRuleTokens?: number,
): { merged: string; contexts: InstructionContextIR[]; tokenEstimate: number } {
  const sorted = [...contexts].sort((a, b) => a.priority - b.priority);
  const parts: string[] = [];
  const used: InstructionContextIR[] = [];
  let tokens = 0;

  for (const ctx of sorted) {
    const chunk = `<!-- rule: ${ctx.relativePath} -->\n${ctx.content.trim()}\n`;
    const nextTokens = tokens + estimateTokens(chunk);
    if (maxRuleTokens && maxRuleTokens > 0 && nextTokens > maxRuleTokens) {
      break;
    }
    parts.push(chunk);
    used.push(ctx);
    tokens = nextTokens;
  }

  return {
    merged: parts.join('\n'),
    contexts: used,
    tokenEstimate: tokens,
  };
}
