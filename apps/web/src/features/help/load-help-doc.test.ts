import { describe, expect, it } from 'vitest';
import { getHelpDoc, listHelpDocSlugs } from './load-help-doc.js';

describe('load-help-doc', () => {
  it('loads help home and registered docs from docs/help/zh', () => {
    const slugs = listHelpDocSlugs();
    expect(slugs).toContain('index');
    expect(slugs).toContain('expressions');
    expect(slugs).toContain('nodes/code');
    expect(slugs).toContain('nodes/webhookTrigger');
    expect(getHelpDoc('nodes/webhookTrigger')).toMatch(/Webhook 节点/);
    expect(getHelpDoc('nodes/webhookTrigger')).toMatch(/X-RXWF-Api-Key/);
    expect(slugs).toContain('nodes/loop');
    expect(getHelpDoc('nodes/loop')).toMatch(/Loop 节点/);
    expect(getHelpDoc('nodes/loop')).toMatch(/batchSize/);
    expect(slugs).toContain('nodes/toolRead');
    expect(slugs).toContain('nodes/aiChatModel');
    expect(slugs).toContain('nodes/aiMemory');
    expect(slugs).toContain('nodes/aiKnowledge');
    expect(slugs).toContain('nodes/aiAgent');
    expect(getHelpDoc('nodes/aiChatModel')).toMatch(/Chat Model 节点/);
    expect(getHelpDoc('nodes/aiChatModel')).toMatch(/ai_languageModel/);
    expect(getHelpDoc('nodes/aiMemory')).toMatch(/Memory 节点/);
    expect(getHelpDoc('nodes/aiMemory')).toMatch(/ai_memory/);
    expect(getHelpDoc('nodes/aiKnowledge')).toMatch(/Knowledge \(RAG\) 节点/);
    expect(getHelpDoc('nodes/aiKnowledge')).toMatch(/ai_knowledge/);
    expect(getHelpDoc('nodes/toolRead')).toMatch(/Read 工具卫星/);
    expect(getHelpDoc('nodes/aiAgent')).toMatch(/AI Agent 节点/);
    expect(getHelpDoc('nodes/aiAgent')).toMatch(/Crew 工人/);
    expect(getHelpDoc('nodes/aiAgent')).toMatch(/群聊 Orchestrator/);
    expect(slugs).toContain('nodes/crewSupervisor');
    expect(getHelpDoc('nodes/crewSupervisor')).toMatch(/Crew \(Supervisor\)/);
    expect(getHelpDoc('nodes/crewSupervisor')).toMatch(/crew_member/);
    expect(getHelpDoc('')).toMatch(/帮助中心|Help center/i);
    expect(getHelpDoc('expressions')).toBeTruthy();
  });
});
