import type { AwfCrewIrV1, AwfCrewMemberIr } from '@rxwf/workflow';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';
import { resolveInputItemTemplateString } from '../expression/item-context.js';

async function resolveMemberSessionId(
  member: AwfCrewMemberIr,
  ctx: NodeExecutionContext,
): Promise<string | null> {
  const memorySession = member.memory?.sessionId?.trim() ?? '';
  const candidates = [memorySession, ctx.sessionId ?? ''];
  for (const raw of candidates) {
    if (!raw) continue;
    const resolved = (await resolveInputItemTemplateString(raw, ctx)).trim();
    if (resolved) return resolved;
  }
  return null;
}

function membersWithMemory(ir: AwfCrewIrV1): AwfCrewMemberIr[] {
  const out: AwfCrewMemberIr[] = [];
  for (const member of ir.members) {
    if (member.memory) out.push(member);
  }
  if (ir.manager?.memory) out.push(ir.manager);
  return out;
}

/** Load agent_session_messages into IR member.memory.history (P4-D2). */
export async function enrichCrewIrWithMemory(
  ir: AwfCrewIrV1,
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<void> {
  if (!deps.agentMemory) return;

  for (const member of membersWithMemory(ir)) {
    const sessionKey = await resolveMemberSessionId(member, ctx);
    if (!sessionKey || !member.memory) continue;

    const maxTurns = Math.max(1, member.memory.maxTurns ?? 20);
    const limit = Math.max(2, Math.min(100, maxTurns * 2));
    const rows = await deps.agentMemory.listRecent(sessionKey, limit);
    const history = rows
      .filter((r) => r.role === 'user' || r.role === 'assistant' || r.role === 'system')
      .map((r) => ({
        role: r.role as 'user' | 'assistant' | 'system',
        content: r.content,
      }));

    if (history.length > 0) {
      member.memory.history = history;
    }
  }
}

/** Persist crew input/answer to each member session that has memory (P4-D2). */
export async function persistCrewMemory(
  ir: AwfCrewIrV1,
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  inputTask: string,
  answer: string,
): Promise<void> {
  if (!deps.agentMemory) return;

  const sessions = new Set<string>();
  for (const member of membersWithMemory(ir)) {
    const sessionKey = await resolveMemberSessionId(member, ctx);
    if (sessionKey) sessions.add(sessionKey);
  }

  for (const sessionId of sessions) {
    await deps.agentMemory.append({
      sessionId,
      role: 'user',
      content: inputTask,
      executionId: ctx.executionId,
    });
    await deps.agentMemory.append({
      sessionId,
      role: 'assistant',
      content: answer,
      executionId: ctx.executionId,
    });
  }
}
