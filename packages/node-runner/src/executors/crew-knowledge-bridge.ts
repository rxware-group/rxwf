import { buildRagSystemPrompt } from '@rxwf/knowledge';
import type { AwfCrewIrV1, AwfCrewMemberIr } from '@rxwf/workflow';
import type { NodeExecutionContext } from '../types/node-executor.js';
import type { PlusExecutorDeps } from './register-plus.js';

function membersWithKnowledge(ir: AwfCrewIrV1): AwfCrewMemberIr[] {
  return [...ir.members, ...(ir.manager ? [ir.manager] : [])].filter(
    (m) => (m.knowledge?.knowledgeBaseIds.length ?? 0) > 0,
  );
}

function knowledgeMode(ir: AwfCrewIrV1): 'inject' | 'native' {
  return ir.crewParams.crewaiKnowledgeMode === 'native' ? 'native' : 'inject';
}

/** Pre-retrieve knowledge: inject backstory or populate chunks for Sidecar native adapter. */
export async function enrichCrewIrWithKnowledge(
  ir: AwfCrewIrV1,
  _ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<void> {
  if (!deps.knowledge) return;

  const queryText = ir.inputTask.trim();
  if (!queryText) return;

  const mode = knowledgeMode(ir);

  for (const member of membersWithKnowledge(ir)) {
    const kbIds = member.knowledge!.knowledgeBaseIds;
    const chunks = await deps.knowledge.queryMany(kbIds, queryText);
    if (chunks.length === 0) continue;

    if (mode === 'native') {
      member.knowledge!.chunks = chunks.map((c) => ({
        text: c.text,
        documentName: c.documentName,
        score: c.score,
      }));
      continue;
    }

    const ragBlock = buildRagSystemPrompt(chunks, 'support');
    const prefix = member.backstory?.trim() ? `${member.backstory.trim()}\n\n` : '';
    member.backstory = `${prefix}Knowledge context:\n${ragBlock}`;
  }
}
