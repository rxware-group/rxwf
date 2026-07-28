import { AwfError } from '@rxwf/shared';
import type { WorkflowNode } from '@rxwf/workflow';
import {
  appendTranscriptMessage,
  resolveGroupSpeaker,
  shouldTerminateByKeywords,
  type GroupChatMessage,
  type GroupChatStepRecord,
  type GroupOrchestratorDecision,
} from './group-chat-helpers.js';

export const ORCHESTRATOR_DEAD_LOOP_CODE = 'E1050';
export const ORCHESTRATOR_DEAD_LOOP_MESSAGE =
  'Group chat orchestrator exceeded max rounds without finish action';

export function detectOrchestratorDeadLoop(
  round: number,
  maxRounds: number,
  orchestratorFinished: boolean,
): boolean {
  return round > maxRounds && !orchestratorFinished;
}

export interface GroupChatOrchestratorLoopInput {
  members: WorkflowNode[];
  task: string;
  maxRounds: number;
  terminationKeywords?: string;
  transcript?: GroupChatMessage[];
  round?: number;
  askOrchestrator: (
    members: WorkflowNode[],
    task: string,
    transcript: GroupChatMessage[],
    round: number,
    maxRounds: number,
  ) => Promise<GroupOrchestratorDecision>;
  invokeParticipant: (opts: {
    member: WorkflowNode;
    task: string;
    transcript: GroupChatMessage[];
    round: number;
    selectionReason?: string;
  }) => Promise<{ content: string }>;
  onStep?: (step: GroupChatStepRecord) => void;
}

export type GroupChatOrchestratorLoopResult =
  | {
      status: 'success';
      answer: string;
      transcript: GroupChatMessage[];
      groupChatSteps: GroupChatStepRecord[];
    }
  | {
      status: 'failed';
      errorCode: string;
      errorMessage: string;
      transcript: GroupChatMessage[];
      groupChatSteps: GroupChatStepRecord[];
    }
  | {
      status: 'waiting';
      transcript: GroupChatMessage[];
      round: number;
      task: string;
      finalAnswer: string;
      groupChatSteps: GroupChatStepRecord[];
    };

export async function runGroupChatOrchestratorLoop(
  input: GroupChatOrchestratorLoopInput,
): Promise<GroupChatOrchestratorLoopResult> {
  const {
    members,
    task,
    maxRounds: rawMaxRounds,
    terminationKeywords = 'TERMINATE,FINISH,完成',
    askOrchestrator,
    invokeParticipant,
    onStep,
  } = input;

  const maxRounds = Math.max(1, Math.min(50, rawMaxRounds));
  const transcript: GroupChatMessage[] = [...(input.transcript ?? [])];
  const groupChatSteps: GroupChatStepRecord[] = [];
  let round = input.round ?? 1;
  let finalAnswer = '';
  let orchestratorFinished = false;

  for (; round <= maxRounds; round++) {
    let decision: GroupOrchestratorDecision;
    try {
      decision = await askOrchestrator(members, task, transcript, round, maxRounds);
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
          transcript,
          groupChatSteps,
        };
      }
      throw err;
    }

    if (decision.action === 'request_user') {
      return {
        status: 'waiting',
        transcript,
        round,
        task,
        finalAnswer,
        groupChatSteps,
      };
    }

    if (decision.action === 'finish') {
      orchestratorFinished = true;
      finalAnswer = decision.answer || finalAnswer;
      const finishStep: GroupChatStepRecord = {
        type: 'groupChatFinish',
        round,
        content: finalAnswer,
        selectionReason: 'orchestrator finish',
      };
      groupChatSteps.push(finishStep);
      onStep?.(finishStep);
      break;
    }

    const speaker = resolveGroupSpeaker(members, decision.member);
    if (!speaker) {
      return {
        status: 'failed',
        errorCode: 'E1049',
        errorMessage: `Group chat orchestrator picked unknown member: ${decision.member}`,
        transcript,
        groupChatSteps,
      };
    }

    let content: string;
    try {
      const result = await invokeParticipant({
        member: speaker,
        task,
        transcript,
        round,
        selectionReason: decision.reason,
      });
      content = result.content;
    } catch (err) {
      if (err instanceof AwfError) {
        return {
          status: 'failed',
          errorCode: err.code,
          errorMessage: err.message,
          transcript,
          groupChatSteps,
        };
      }
      throw err;
    }

    appendTranscriptMessage(transcript, {
      author: speaker.name,
      authorNodeId: speaker.id,
      role: 'agent',
      content,
      round,
    });

    const turnStep: GroupChatStepRecord = {
      type: 'groupChatTurn',
      round,
      speaker: speaker.name,
      content,
      selectionReason: decision.reason,
    };
    groupChatSteps.push(turnStep);
    onStep?.(turnStep);

    finalAnswer = content;

    if (shouldTerminateByKeywords(content, terminationKeywords)) {
      orchestratorFinished = true;
      const finishStep: GroupChatStepRecord = {
        type: 'groupChatFinish',
        round,
        content: finalAnswer,
      };
      groupChatSteps.push(finishStep);
      onStep?.(finishStep);
      break;
    }
  }

  if (detectOrchestratorDeadLoop(round, maxRounds, orchestratorFinished)) {
    return {
      status: 'failed',
      errorCode: ORCHESTRATOR_DEAD_LOOP_CODE,
      errorMessage: ORCHESTRATOR_DEAD_LOOP_MESSAGE,
      transcript,
      groupChatSteps,
    };
  }

  return {
    status: 'success',
    answer: finalAnswer,
    transcript,
    groupChatSteps,
  };
}
