import { AwfError } from '@rxwf/shared';
import type {
  GroupChatMessage,
  GroupChatParticipant,
  GroupChatRunInput,
  GroupChatRunResult,
  GroupChatStepRecord,
  ModelRef,
} from '@rxwf/ai-runtime-stub';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

type GroupOrchestratorDecision =
  | { action: 'speak'; member: string; reason?: string }
  | { action: 'finish'; answer: string };

export function formatGroupChatTranscriptMarkdown(
  transcript: GroupChatMessage[],
): string {
  if (transcript.length === 0) return '';
  return transcript
    .map((m) => `### ${m.author} · round ${m.round}\n\n${m.content}`)
    .join('\n\n---\n\n');
}

function appendMessage(
  transcript: GroupChatMessage[],
  message: Omit<GroupChatMessage, 'at'> & { at?: string },
): GroupChatMessage {
  const entry: GroupChatMessage = {
    ...message,
    at: message.at ?? new Date().toISOString(),
  };
  transcript.push(entry);
  return entry;
}

function shouldTerminateByKeywords(content: string, keywordsCsv: string): boolean {
  const keywords = keywordsCsv
    .split(/[,;\s]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return false;
  const lower = content.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function resolveParticipant(
  participants: GroupChatParticipant[],
  memberKey: string,
): GroupChatParticipant | null {
  const key = memberKey.trim().toLowerCase();
  if (!key) return null;
  return (
    participants.find((p) => p.id.toLowerCase() === key) ??
    participants.find((p) => p.name.trim().toLowerCase() === key) ??
    participants.find((p) => p.role.trim().toLowerCase() === key) ??
    null
  );
}

function parseOrchestratorDecision(raw: string): GroupOrchestratorDecision | null {
  const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (parsed.action === 'finish') {
      return { action: 'finish', answer: String(parsed.answer ?? '').trim() };
    }
    if (parsed.action === 'speak') {
      const member = String(parsed.member ?? '').trim();
      if (!member) return null;
      return {
        action: 'speak',
        member,
        reason: String(parsed.reason ?? '').trim() || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function selectRoundRobinParticipant(
  participants: GroupChatParticipant[],
  round: number,
): GroupChatParticipant {
  const index = (Math.max(1, round) - 1) % participants.length;
  return participants[index] ?? participants[0]!;
}

async function askOrchestrator(
  chat: (model: ModelRef, system: string, user: string) => Promise<string>,
  model: ModelRef,
  participants: GroupChatParticipant[],
  task: string,
  transcript: GroupChatMessage[],
  round: number,
  maxRounds: number,
): Promise<GroupOrchestratorDecision> {
  const roster = participants.map((p) => ({ id: p.id, name: p.name, role: p.role }));
  const system = `You are a group chat ORCHESTRATOR. Pick who speaks next or finish the discussion.
Respond with ONLY one JSON object (no markdown).

Next speaker:
{"action":"speak","member":"<id, name, or role>","reason":"<optional>"}

When done:
{"action":"finish","answer":"<final consolidated answer>"}

Roster:
${JSON.stringify(roster, null, 2)}

Task:
${task}

Transcript:
${JSON.stringify(transcript, null, 2)}

Current round: ${round} / ${maxRounds}`;

  const user = `Choose the next group chat action for round ${round}.`;
  const text = await chat(model, system, user);
  const decision = parseOrchestratorDecision(text);
  if (!decision) {
    throw new AwfError(
      'E1049',
      `Group chat orchestrator returned invalid JSON: ${text.slice(0, 200)}`,
    );
  }
  return decision;
}

interface GroupChatGraphContext {
  input: GroupChatRunInput;
  chatOrchestrator: (model: ModelRef, system: string, user: string) => Promise<string>;
}

interface GroupChatGraphState {
  task: string;
  transcript: GroupChatMessage[];
  round: number;
  maxRounds: number;
  speakerSelection: 'roundRobin' | 'orchestrator';
  terminationKeywords: string;
  participants: GroupChatParticipant[];
  orchestratorModel?: ModelRef;
  finalAnswer: string;
  steps: GroupChatStepRecord[];
  done: boolean;
  failed: boolean;
  errorCode?: string;
  errorMessage?: string;
  currentSpeakerId: string | null;
  selectionReason?: string;
}

const GroupChatState = Annotation.Root({
  task: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  transcript: Annotation<GroupChatMessage[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  round: Annotation<number>({ reducer: (_, b) => b, default: () => 1 }),
  maxRounds: Annotation<number>({ reducer: (_, b) => b, default: () => 8 }),
  speakerSelection: Annotation<'roundRobin' | 'orchestrator'>({
    reducer: (_, b) => b,
    default: () => 'roundRobin',
  }),
  terminationKeywords: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  participants: Annotation<GroupChatParticipant[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  orchestratorModel: Annotation<ModelRef | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  finalAnswer: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  steps: Annotation<GroupChatStepRecord[]>({ reducer: (_, b) => b, default: () => [] }),
  done: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  failed: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  errorCode: Annotation<string | undefined>({ reducer: (_, b) => b, default: () => undefined }),
  errorMessage: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
  currentSpeakerId: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  selectionReason: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
});

function compileGroupChatGraph(ctx: GroupChatGraphContext) {
  async function scheduleSpeaker(
    state: GroupChatGraphState,
  ): Promise<Partial<GroupChatGraphState>> {
    if (state.done || state.failed) return {};
    if (state.round > state.maxRounds) {
      if (!state.finalAnswer.trim()) {
        return {
          done: true,
          failed: true,
          errorCode: 'E1050',
          errorMessage: 'Group chat exceeded max rounds without a final answer',
        };
      }
      return { done: true };
    }

    if (state.speakerSelection === 'orchestrator' && state.orchestratorModel) {
      try {
        const decision = await askOrchestrator(
          ctx.chatOrchestrator,
          state.orchestratorModel,
          state.participants,
          state.task,
          state.transcript,
          state.round,
          state.maxRounds,
        );
        if (decision.action === 'finish') {
          const answer = decision.answer || state.finalAnswer;
          const steps = [
            ...state.steps,
            {
              type: 'groupChatFinish' as const,
              round: state.round,
              content: answer,
              selectionReason: 'orchestrator finish',
            },
          ];
          ctx.input.onStep?.(steps[steps.length - 1]!);
          return { done: true, finalAnswer: answer, steps };
        }
        const resolved = resolveParticipant(state.participants, decision.member);
        if (!resolved) {
          return {
            done: true,
            failed: true,
            errorCode: 'E1049',
            errorMessage: `Group chat orchestrator picked unknown member: ${decision.member}`,
          };
        }
        return {
          currentSpeakerId: resolved.id,
          selectionReason: decision.reason,
        };
      } catch (err) {
        if (err instanceof AwfError) {
          return {
            done: true,
            failed: true,
            errorCode: err.code,
            errorMessage: err.message,
          };
        }
        throw err;
      }
    }

    const speaker = selectRoundRobinParticipant(state.participants, state.round);
    return { currentSpeakerId: speaker.id, selectionReason: undefined };
  }

  async function participantTurn(
    state: GroupChatGraphState,
  ): Promise<Partial<GroupChatGraphState>> {
    if (state.done || state.failed || !state.currentSpeakerId) return {};
    const speaker = state.participants.find((p) => p.id === state.currentSpeakerId);
    if (!speaker) {
      return {
        done: true,
        failed: true,
        errorCode: 'E1049',
        errorMessage: `Group chat speaker not found: ${state.currentSpeakerId}`,
      };
    }

    let content: string;
    try {
      const result = await ctx.input.invokeParticipant({
        participantId: speaker.id,
        task: state.task,
        transcript: state.transcript,
        round: state.round,
      });
      content = result.content;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        done: true,
        failed: true,
        errorCode: err instanceof AwfError ? err.code : 'E2003',
        errorMessage: message,
      };
    }

    const transcript = [...state.transcript];
    appendMessage(transcript, {
      author: speaker.name,
      authorNodeId: speaker.id,
      role: 'agent',
      content,
      round: state.round,
    });

    const turnStep: GroupChatStepRecord = {
      type: 'groupChatTurn',
      round: state.round,
      speaker: speaker.name,
      content,
      selectionReason: state.selectionReason,
    };
    const steps = [...state.steps, turnStep];
    ctx.input.onStep?.(turnStep);

    let done = false;
    let finalAnswer = content;
    const nextSteps = [...steps];
    if (shouldTerminateByKeywords(content, state.terminationKeywords)) {
      done = true;
      const finishStep: GroupChatStepRecord = {
        type: 'groupChatFinish',
        round: state.round,
        content: finalAnswer,
      };
      nextSteps.push(finishStep);
      ctx.input.onStep?.(finishStep);
    }

    return {
      transcript,
      steps: nextSteps,
      finalAnswer,
      done,
      round: state.round + 1,
      currentSpeakerId: null,
      selectionReason: undefined,
    };
  }

  return new StateGraph(GroupChatState)
    .addNode('schedule_speaker', scheduleSpeaker)
    .addNode('participant_turn', participantTurn)
    .addEdge(START, 'schedule_speaker')
    .addConditionalEdges('schedule_speaker', (state) => {
      if (state.failed || state.done) return END;
      if (!state.currentSpeakerId) return END;
      return 'participant_turn';
    })
    .addConditionalEdges('participant_turn', (state) => {
      if (state.failed || state.done) return END;
      return 'schedule_speaker';
    })
    .compile();
}

export interface RunGroupChatGraphOptions {
  chatOrchestrator: (model: ModelRef, system: string, user: string) => Promise<string>;
}

export async function runGroupChatGraph(
  input: GroupChatRunInput,
  options: RunGroupChatGraphOptions,
): Promise<GroupChatRunResult> {
  if (input.participants.length < 2) {
    return {
      status: 'failed',
      answer: '',
      transcript: input.transcript ?? [],
      groupChatSteps: [],
      errorCode: 'E1048',
      errorMessage: 'Group Chat requires at least two participants',
    };
  }

  const maxRounds = Math.max(1, Math.min(50, input.maxRounds));
  const graph = compileGroupChatGraph({ input, chatOrchestrator: options.chatOrchestrator });
  const initial: GroupChatGraphState = {
    task: input.task,
    transcript: [...(input.transcript ?? [])],
    round: input.round ?? 1,
    maxRounds,
    speakerSelection: input.speakerSelection,
    terminationKeywords: input.terminationKeywords,
    participants: input.participants,
    orchestratorModel: input.orchestratorModel,
    finalAnswer: input.finalAnswer ?? '',
    steps: [],
    done: false,
    failed: false,
    currentSpeakerId: null,
  };

  const finalState = (await graph.invoke(initial)) as GroupChatGraphState;

  if (finalState.failed) {
    return {
      status: 'failed',
      answer: finalState.finalAnswer,
      transcript: finalState.transcript,
      groupChatSteps: finalState.steps,
      errorCode: finalState.errorCode,
      errorMessage: finalState.errorMessage,
    };
  }

  const transcript = finalState.transcript;
  return {
    status: 'success',
    answer: finalState.finalAnswer,
    transcript,
    groupChatSteps: finalState.steps,
    transcriptMarkdown: input.returnTranscriptMarkdown
      ? formatGroupChatTranscriptMarkdown(transcript)
      : undefined,
  };
}
