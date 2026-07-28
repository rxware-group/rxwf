import { AwfError } from '@rxwf/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelRef {
  provider: 'ollama' | 'openai-compatible' | string;
  model: string;
  baseUrl?: string;
  credentialId?: string;
}

export type AiStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; input: unknown }
  | { type: 'tool_end'; tool: string; output: unknown }
  | { type: 'agent_step'; step: unknown }
  | { type: 'satellite_invoke_start'; input?: unknown }
  | {
      type: 'satellite_invoke_end';
      output?: unknown;
      durationMs?: number;
      error?: string;
    }
  /** Output Parser: schema consumed by agent (not an LLM round-trip). */
  | { type: 'satellite_schema_read'; schema?: unknown }
  /** Memory satellite: session messages after load/append. */
  | {
      type: 'satellite_memory_snapshot';
      sessionId?: string;
      messages?: Array<{ role: string; content: string; createdAt?: string }>;
    }
  /** Knowledge satellite: RAG retrieval for agent user message. */
  | {
      type: 'satellite_knowledge_query';
      query?: string;
      knowledgeBaseIds?: string[];
      chunks?: Array<{
        text: string;
        score: number;
        documentName: string;
        knowledgeBaseId: string;
        documentId: string;
        chunkIndex: number;
      }>;
    };

export interface AiExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  environment: 'test' | 'prod';
  sessionId?: string;
  signal?: AbortSignal;
  onStream?: (chunk: AiStreamChunk) => void;
  /** Connected aiChatModel node id — each LLM round-trip emits satellite_invoke_* events. */
  modelNodeId?: string;
  onSatelliteStream?: (satelliteNodeId: string, chunk: AiStreamChunk) => void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON-schema-shaped object for tool args */
  parameters: Record<string, unknown>;
  source:
    | { type: 'mcp'; serverId: string; toolName: string }
    | { type: 'workflow'; workflowId: string }
    | {
        type: 'http';
        method: string;
        url: string;
        headers?: Record<string, unknown>;
        body?: string;
      }
    | { type: 'builtin'; name: string }
    | { type: 'subagent'; hubNodeId: string }
    | { type: 'skill'; skillPath: string; mode?: 'sub-agent' | 'single-shot' }
    | {
        type: 'filesystem';
        operation: 'read' | 'write' | 'grep';
        toolNodeId: string;
      }
    | { type: 'shell'; toolNodeId: string }
    | { type: 'web_search'; toolNodeId: string };
}

export interface AgentRunInput {
  model: ModelRef;
  systemPrompt?: string;
  userMessage: string;
  tools: ToolDefinition[];
  maxIterations: number;
  timeoutMs: number;
  returnIntermediateSteps?: boolean;
  history?: ChatMessage[];
  /** JSON Schema for structured final output (Output Parser satellite). */
  outputSchema?: Record<string, unknown>;
  invokeTool?: (
    def: ToolDefinition,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}

export interface AgentRunResult {
  items: Array<{ json: Record<string, unknown> }>;
  intermediateSteps?: unknown[];
}

export interface GroupChatMessage {
  author: string;
  authorNodeId: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  round: number;
  at: string;
}

export interface GroupChatStepRecord {
  type: 'groupChatTurn' | 'groupChatUserProxy' | 'groupChatFinish';
  round: number;
  speaker?: string;
  content?: string;
  selectionReason?: string;
}

export interface GroupChatParticipant {
  id: string;
  name: string;
  role: string;
}

export interface GroupChatRunInput {
  task: string;
  participants: GroupChatParticipant[];
  speakerSelection: 'roundRobin' | 'orchestrator';
  orchestratorModel?: ModelRef;
  maxRounds: number;
  terminationKeywords: string;
  returnTranscriptMarkdown?: boolean;
  transcript?: GroupChatMessage[];
  round?: number;
  finalAnswer?: string;
  invokeParticipant: (input: {
    participantId: string;
    task: string;
    transcript: GroupChatMessage[];
    round: number;
  }) => Promise<{ content: string }>;
  onStep?: (step: GroupChatStepRecord) => void;
}

export interface GroupChatRunResult {
  status: 'success' | 'failed';
  answer: string;
  transcript: GroupChatMessage[];
  groupChatSteps: GroupChatStepRecord[];
  transcriptMarkdown?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface AiChatOptions {
  model?: ModelRef;
  signal?: AbortSignal;
}

export interface AiRuntime {
  chat(
    messages: ChatMessage[],
    opts?: AiChatOptions,
  ): AsyncGenerator<string, void, unknown>;
  runAgent(input: AgentRunInput, ctx: AiExecutionContext): Promise<AgentRunResult>;
  runGroupChat(
    input: GroupChatRunInput,
    ctx: AiExecutionContext,
  ): Promise<GroupChatRunResult>;
}

export {
  chunksToAgentSteps,
  type AgentStepRecord,
  type AgentStepStatus,
  type TimestampedChunk,
} from './agent-steps.js';

export function createDisabledAiRuntime(): AiRuntime {
  return {
    async *chat(_messages, _opts) {
      throw new AwfError('E3001', 'AI runtime disabled (plus features off)');
    },
    async runAgent() {
      throw new AwfError('E3001', 'AI runtime disabled (plus features off)');
    },
    async runGroupChat() {
      throw new AwfError('E3001', 'AI runtime disabled (plus features off)');
    },
  };
}
