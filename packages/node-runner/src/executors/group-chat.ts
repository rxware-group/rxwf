import {
  collectGroupMembers,
} from '@rxwf/workflow';
import { AwfError } from '@rxwf/shared';
import type { NodeExecutionContext, NodeRunResult } from '../types/node-executor.js';
import type { AgentStepRecord } from '@rxwf/ai-runtime-stub';
import type { PlusExecutorDeps } from './register-plus.js';
import { resolveAgentParameters } from '../expression/resolve-agent-params.js';
import { runAiAgentNode } from './run-ai-agent-node.js';
import {
  appendTranscriptMessage,
  askGroupOrchestrator,
  buildGroupChatRolePrompt,
  buildGroupChatTask,
  configFlag,
  resolveGroupOrchestratorModel,
  resolveGroupSpeaker,
  selectRoundRobinMember,
  shouldPauseForUserProxy,
  shouldTerminateByKeywords,
  type GroupChatCheckpoint,
  type GroupChatMessage,
  type GroupChatStepRecord,
} from './group-chat-helpers.js';

function toAgentStepRecords(steps: GroupChatStepRecord[]): AgentStepRecord[] {
  return steps.map((step) => ({
    type: 'agent_step',
    status: 'success',
    output: step,
  }));
}

function buildCheckpoint(
  transcript: GroupChatMessage[],
  round: number,
  task: string,
  memberIds: string[],
  finalAnswer?: string,
): GroupChatCheckpoint {
  return { transcript, round, task, memberIds, finalAnswer };
}

function waitingForUserProxy(
  ctx: NodeExecutionContext,
  config: Record<string, unknown>,
  checkpoint: GroupChatCheckpoint,
): NodeRunResult {
  const prompt = String(config.userProxyPrompt ?? '请输入纠偏或补充…');
  return {
    status: 'waiting',
    metadata: {
      hitl: {
        prompt,
        allowReject: false,
        allowSupplement: true,
      },
      groupChat: { checkpoint },
    },
  };
}

function resolveExecutionBackend(
  config: Record<string, unknown>,
  ctx: NodeExecutionContext,
): 'native' | 'langgraph' {
  if (configFlag(config.userProxyEnabled, false)) return 'native';
  if (ctx.orchestrationResume?.kind === 'groupChat') return 'native';
  const backend = String(config.executionBackend ?? 'native').toLowerCase();
  return backend === 'langgraph' ? 'langgraph' : 'native';
}

export async function runGroupChatLangGraph(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const groupChatNodeId = ctx.nodeId;
  if (!definition || !groupChatNodeId) {
    throw new AwfError('E2003', 'groupChat requires workflow definition context');
  }
  if (!deps.ai?.runGroupChat) {
    return {
      status: 'failed',
      errorCode: 'E3001',
      errorMessage: 'AI runtime does not support runGroupChat (use LangChain runtime)',
    };
  }

  const members = collectGroupMembers(definition, groupChatNodeId);
  if (members.length < 2) {
    return {
      status: 'failed',
      errorCode: 'E1048',
      errorMessage: 'Group Chat requires at least two connected aiAgent members',
    };
  }

  const config = ctx.config;
  const speakerSelection = String(config.speakerSelection ?? 'roundRobin') as
    | 'roundRobin'
    | 'orchestrator';
  const terminationKeywords = String(
    config.terminationKeywords ?? 'TERMINATE,FINISH,完成',
  );
  const returnTranscript = configFlag(config.returnTranscript, true);
  const returnTranscriptMarkdown = configFlag(config.returnTranscriptMarkdown, false);
  const maxRounds = Math.max(1, Math.min(50, Number(config.maxRounds ?? 8)));
  const task = buildGroupChatTask(config, ctx.inputItems);

  let transcript: GroupChatMessage[] = [];
  let round = 1;
  let finalAnswer = '';

  const resume = ctx.orchestrationResume;
  if (resume?.kind === 'groupChat') {
    const cp = resume.checkpoint;
    transcript = [...cp.transcript];
    round = cp.round;
    finalAnswer = cp.finalAnswer ?? '';
    if (resume.userMessage.trim()) {
      appendTranscriptMessage(transcript, {
        author: 'User',
        authorNodeId: 'user',
        role: 'user',
        content: resume.userMessage.trim(),
        round,
      });
    }
  }

  let orchestratorModel: ReturnType<typeof resolveGroupOrchestratorModel> | undefined;
  if (speakerSelection === 'orchestrator') {
    try {
      orchestratorModel = resolveGroupOrchestratorModel(
        definition,
        groupChatNodeId,
        config,
      );
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
        };
      }
      throw err;
    }
  }

  const result = await deps.ai.runGroupChat(
    {
      task,
      participants: members.map((m) => ({
        id: m.id,
        name: m.name,
        role: String(m.parameters.role ?? m.name),
      })),
      speakerSelection,
      orchestratorModel,
      maxRounds,
      terminationKeywords,
      returnTranscriptMarkdown,
      transcript,
      round,
      finalAnswer,
      invokeParticipant: async ({ participantId, task: turnTask, transcript: tx, round: r }) => {
        const speaker = members.find((m) => m.id === participantId);
        if (!speaker) {
          throw new AwfError('E1049', `Group chat speaker not found: ${participantId}`);
        }
        ctx.onAgentStream?.({
          type: 'agent_step',
          step: {
            type: 'groupChatTurn',
            round: r,
            speaker: speaker.name,
            status: 'running',
          },
        });
        const turnItems = [{ json: { task: turnTask, transcript: tx, round: r } }];
        const speakerParams = await resolveAgentParameters(speaker.parameters, {
          ...ctx,
          inputItems: turnItems,
        });
        const rolePrompt = buildGroupChatRolePrompt(speakerParams);
        const agentResult = await runAiAgentNode(ctx, deps, {
          agentNodeId: speaker.id,
          agentParams: speakerParams,
          inputItems: turnItems,
          systemMessageExtra: rolePrompt,
        });
        if (agentResult.status !== 'success') {
          throw new AwfError(
            agentResult.errorCode ?? 'E2003',
            agentResult.errorMessage ?? `Group chat member ${speaker.name} failed`,
          );
        }
        const content = String(agentResult.outputItems?.[0]?.[0]?.json?.answer ?? '');
        ctx.onAgentStream?.({
          type: 'agent_step',
          step: {
            type: 'groupChatTurn',
            round: r,
            speaker: speaker.name,
            content,
            status: 'success',
          },
        });
        return { content };
      },
      onStep: (step) => {
        ctx.onAgentStream?.({ type: 'agent_step', step: { ...step, status: 'success' } });
      },
    },
    {
      executionId: ctx.executionId ?? '',
      workflowId: ctx.workflowId ?? '',
      nodeId: ctx.nodeId ?? groupChatNodeId,
      environment: 'test',
      sessionId: ctx.sessionId,
      onStream: ctx.onAgentStream,
    },
  );

  if (result.status === 'failed') {
    return {
      status: 'failed',
      errorCode: result.errorCode ?? 'E2003',
      errorMessage: result.errorMessage ?? 'Group chat failed',
    };
  }

  const outputJson: Record<string, unknown> = {
    answer: result.answer,
    groupChatSteps: result.groupChatSteps,
    executionBackend: 'langgraph',
  };
  if (returnTranscript) {
    outputJson.transcript = result.transcript;
  }
  if (result.transcriptMarkdown) {
    outputJson.transcriptMarkdown = result.transcriptMarkdown;
  }

  return {
    status: 'success',
    outputItems: [[{ json: outputJson }]],
    metadata: { agentSteps: toAgentStepRecords(result.groupChatSteps) },
  };
}

export async function runGroupChatNative(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
): Promise<NodeRunResult> {
  const definition = ctx.workflowDefinition;
  const groupChatNodeId = ctx.nodeId;
  if (!definition || !groupChatNodeId) {
    throw new AwfError('E2003', 'groupChat requires workflow definition context');
  }

  const members = collectGroupMembers(definition, groupChatNodeId);
  if (members.length < 2) {
    return {
      status: 'failed',
      errorCode: 'E1048',
      errorMessage: 'Group Chat requires at least two connected aiAgent members',
    };
  }

  const config = ctx.config;
  const maxRounds = Math.max(1, Math.min(50, Number(config.maxRounds ?? 8)));
  const speakerSelection = String(config.speakerSelection ?? 'roundRobin');
  const terminationKeywords = String(
    config.terminationKeywords ?? 'TERMINATE,FINISH,完成',
  );
  const returnTranscript = configFlag(config.returnTranscript, true);
  const memberIds = members.map((m) => m.id);

  let transcript: GroupChatMessage[] = [];
  let round = 1;
  let task = buildGroupChatTask(config, ctx.inputItems);
  let finalAnswer = '';
  let skipUserProxyOnce = false;

  const resume = ctx.orchestrationResume;
  if (resume?.kind === 'groupChat') {
    const cp = resume.checkpoint;
    transcript = [...cp.transcript];
    round = cp.round;
    task = cp.task;
    finalAnswer = cp.finalAnswer ?? '';
    skipUserProxyOnce = true;
    if (resume.userMessage.trim()) {
      appendTranscriptMessage(transcript, {
        author: 'User',
        authorNodeId: 'user',
        role: 'user',
        content: resume.userMessage.trim(),
        round,
      });
    }
  }

  const groupChatSteps: GroupChatStepRecord[] = [];
  let orchestratorModel: ReturnType<typeof resolveGroupOrchestratorModel> | null = null;
  if (speakerSelection === 'orchestrator') {
    try {
      orchestratorModel = resolveGroupOrchestratorModel(
        definition,
        groupChatNodeId,
        config,
      );
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
        };
      }
      throw err;
    }
  }

  for (; round <= maxRounds; round++) {
    if (
      shouldPauseForUserProxy(round, config, skipUserProxyOnce)
    ) {
      return waitingForUserProxy(
        ctx,
        config,
        buildCheckpoint(transcript, round, task, memberIds, finalAnswer),
      );
    }
    skipUserProxyOnce = false;

    let speaker = selectRoundRobinMember(members, round);
    let selectionReason: string | undefined;

    if (speakerSelection === 'orchestrator' && orchestratorModel) {
      try {
        const decision = await askGroupOrchestrator(
          deps,
          orchestratorModel,
          members,
          task,
          transcript,
          round,
          maxRounds,
        );
        if (decision.action === 'request_user') {
          return waitingForUserProxy(
            ctx,
            config,
            buildCheckpoint(transcript, round, task, memberIds, finalAnswer),
          );
        }
        if (decision.action === 'finish') {
          finalAnswer = decision.answer || finalAnswer;
          groupChatSteps.push({
            type: 'groupChatFinish',
            round,
            content: finalAnswer,
            selectionReason: 'orchestrator finish',
          });
          break;
        }
        const resolved = resolveGroupSpeaker(members, decision.member);
        if (!resolved) {
          return {
            status: 'failed',
            errorCode: 'E1049',
            errorMessage: `Group chat orchestrator picked unknown member: ${decision.member}`,
          };
        }
        speaker = resolved;
        selectionReason = decision.reason;
      } catch (err) {
        if (err instanceof AwfError) {
          return {
            status: 'failed',
            errorCode: err.code,
            errorMessage: err.message,
          };
        }
        throw err;
      }
    }

    ctx.onAgentStream?.({
      type: 'agent_step',
      step: {
        type: 'groupChatTurn',
        round,
        speaker: speaker.name,
        status: 'running',
        selectionReason,
      },
    });

    const turnItems = [{ json: { task, transcript, round } }];
    const speakerParams = await resolveAgentParameters(speaker.parameters, {
      ...ctx,
      inputItems: turnItems,
    });
    const rolePrompt = buildGroupChatRolePrompt(speakerParams);
    const result = await runAiAgentNode(ctx, deps, {
      agentNodeId: speaker.id,
      agentParams: speakerParams,
      inputItems: turnItems,
      systemMessageExtra: rolePrompt,
    });

    if (result.status !== 'success') {
      return {
        status: 'failed',
        errorCode: result.errorCode ?? 'E2003',
        errorMessage: result.errorMessage ?? `Group chat member ${speaker.name} failed`,
      };
    }

    const content = String(result.outputItems?.[0]?.[0]?.json?.answer ?? '');
    appendTranscriptMessage(transcript, {
      author: speaker.name,
      authorNodeId: speaker.id,
      role: 'agent',
      content,
      round,
    });

    const step: GroupChatStepRecord = {
      type: 'groupChatTurn',
      round,
      speaker: speaker.name,
      content,
      selectionReason,
    };
    groupChatSteps.push(step);

    ctx.onAgentStream?.({
      type: 'agent_step',
      step: { ...step, status: 'success' },
    });

    finalAnswer = content;

    if (shouldTerminateByKeywords(content, terminationKeywords)) {
      groupChatSteps.push({ type: 'groupChatFinish', round, content: finalAnswer });
      break;
    }
  }

  if (!finalAnswer.trim() && round > maxRounds) {
    return {
      status: 'failed',
      errorCode: 'E1050',
      errorMessage: 'Group chat exceeded max rounds without a final answer',
    };
  }

  const outputJson: Record<string, unknown> = {
    answer: finalAnswer,
    groupChatSteps,
  };
  if (returnTranscript) {
    outputJson.transcript = transcript;
  }

  return {
    status: 'success',
    outputItems: [[{ json: outputJson }]],
    metadata: { agentSteps: toAgentStepRecords(groupChatSteps) },
  };
}

export function createGroupChatExecutor(deps: PlusExecutorDeps) {
  return {
    type: 'groupChat',
    async execute(ctx: NodeExecutionContext) {
      const backend = resolveExecutionBackend(ctx.config, ctx);
      if (backend === 'langgraph') {
        return runGroupChatLangGraph(ctx, deps);
      }
      return runGroupChatNative(ctx, deps);
    },
  };
}
