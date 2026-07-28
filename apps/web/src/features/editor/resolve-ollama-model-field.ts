import type { WorkflowDefinition } from '../../api/client.js';
import { DEFAULT_OLLAMA_URL } from './ollama-model-names.js';
import type { ParamField } from './node-param-schemas.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];

const DIRECT_LLM_CONFIG_NODE_TYPES = new Set(['llm', 'llmStream']);

const OLLAMA_SETTINGS_FALLBACK_TYPES = new Set(['ragAnswer']);

const PROVIDER_MODEL_FIELDS: Record<
  string,
  { providerKey: string; baseUrlKey?: string }
> = {
  model: { providerKey: 'provider', baseUrlKey: 'baseUrl' },
  supervisorModel: { providerKey: 'supervisorProvider', baseUrlKey: 'supervisorBaseUrl' },
  orchestratorModel: { providerKey: 'orchestratorProvider', baseUrlKey: 'orchestratorBaseUrl' },
};

export type OllamaModelFieldContext = {
  baseUrl?: string;
  liveOnly?: boolean;
  fetchOnFocus?: boolean;
};

function usesDirectOllamaConfig(node: WorkflowNode): boolean {
  if (!DIRECT_LLM_CONFIG_NODE_TYPES.has(node.type)) return false;
  return String(node.parameters.provider ?? 'ollama') === 'ollama';
}

export function resolveOllamaModelField(
  node: WorkflowNode,
  field: ParamField,
): OllamaModelFieldContext | null {
  if (field.type !== 'text' || field.plainText) return null;

  if (usesDirectOllamaConfig(node)) {
    if (field.key !== 'model') return null;
    const rawBaseUrl = String(node.parameters.baseUrl ?? DEFAULT_OLLAMA_URL).trim();
    return {
      baseUrl: rawBaseUrl || DEFAULT_OLLAMA_URL,
      liveOnly: true,
      fetchOnFocus: true,
    };
  }

  if (OLLAMA_SETTINGS_FALLBACK_TYPES.has(node.type)) {
    if (field.key !== 'model') return null;
    return {};
  }

  const ctx = PROVIDER_MODEL_FIELDS[field.key];
  if (!ctx) return null;

  const provider = String(node.parameters[ctx.providerKey] ?? 'ollama');
  if (provider !== 'ollama') return null;

  const rawBaseUrl = ctx.baseUrlKey
    ? String(node.parameters[ctx.baseUrlKey] ?? DEFAULT_OLLAMA_URL).trim()
    : '';
  return { baseUrl: rawBaseUrl || DEFAULT_OLLAMA_URL };
}
