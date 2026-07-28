import { useEffect, useState } from 'react';
import { t, useLabels } from '../../i18n/labels.js';
import { resolveLabel } from '../../i18n/resolve-label.js';
import type { WorkflowDefinition } from '../../api/client.js';
import { getBasicParamSchema, getSettingsParamSchema, type ParamField } from './node-param-schemas.js';
import { formatJsonParamValue } from './editor-json-params.js';
import type { NodeDebugState } from './editor-debug-types.js';
import { WebhookTriggerPanel } from './WebhookTriggerPanel.js';
import type { WebhookListenError } from './webhook-listen-error.js';
import { McpClientFields } from './McpClientFields.js';
import { normalizeMcpTools } from './mcp-tools-utils.js';
import { isStringFieldType } from './field-modes.js';
import { OllamaModelParamField } from './OllamaModelParamField.js';
import { ParamTemplateField } from './ParamTemplateField.js';
import { resolveOllamaModelField } from './resolve-ollama-model-field.js';
import { DEFAULT_OLLAMA_URL } from './ollama-model-names.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { NumberInput } from '../../components/NumberInput.js';
import { CredentialSelect } from './CredentialSelect.js';
import type { ExecuteNodeFn } from './execute-node.js';
import { BuiltinSatelliteToolDescription } from './BuiltinSatelliteToolDescription.js';
import { isFixedCapabilityToolType } from './fixed-capability-tool-types.js';
import { findMainFlowTriggerOnPath } from './main-flow-predecessors.js';
import { ToolWorkflowSelect } from './ToolWorkflowSelect.js';
import { SubworkflowTriggerFields } from './SubworkflowTriggerFields.js';
import { SubworkflowInputMappingFields } from './SubworkflowInputMappingFields.js';
import { SkillRegistrySelect } from './SkillRegistrySelect.js';
import { SkillPathParamField } from './SkillPathParamField.js';
import { api } from '../../api/client.js';
import { WorkflowRunFields } from './WorkflowRunFields.js';
import { HttpRequestAdvancedFields } from './HttpRequestAdvancedFields.js';
import { ExecuteCommandFields } from './ExecuteCommandFields.js';
import { KnowledgeBaseIdsField } from './KnowledgeBaseIdsField.js';
import { SwitchBranchesPanel } from './SwitchBranchesPanel.js';
import { CodeJsEditor } from './CodeJsEditor.js';
import { JsonParamEditor } from './JsonParamEditor.js';
import {
  nodeRunnerOverrideToNodePatch,
  nodeSupportsRunnerOverride,
  type RunnerPolicy,
} from '../runners/runner-policy-types.js';
import {
  AI_AGENT_CREW_PARAM_KEYS,
  isCrewEditorEnabled,
} from './crew-editor-settings.js';
import { RunnerCompactEditor, type RunnerOption } from '../runners/RunnerCompactEditor.js';
import type { LabelMap } from '../../i18n/labels.js';

function formatSelectOptionLabel(option: string): string {
  if (option === option.toUpperCase()) return option;
  return option.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function providerOptionLabel(labels: LabelMap, option: string, labelKey?: string): string {
  if (labelKey) {
    const fallbacks: Record<string, string> = {
      ollama: 'Ollama',
      'openai-compatible': 'OpenAI 兼容',
    };
    return t(labels, labelKey, undefined, fallbacks[option] ?? formatSelectOptionLabel(option));
  }
  return formatSelectOptionLabel(option);
}

type WorkflowNode = WorkflowDefinition['nodes'][number];

type ParamsTab = 'params' | 'settings' | 'crew';

function splitAgentParamFields(
  node: WorkflowNode,
  fields: ParamField[],
  definition: WorkflowDefinition,
): { paramsFields: ParamField[]; crewFields: ParamField[] } {
  if (node.type !== 'aiAgent' || !isCrewEditorEnabled(definition.settings)) {
    return { paramsFields: fields, crewFields: [] };
  }
  return {
    paramsFields: fields.filter((f) => !AI_AGENT_CREW_PARAM_KEYS.has(f.key)),
    crewFields: fields.filter((f) => AI_AGENT_CREW_PARAM_KEYS.has(f.key)),
  };
}

const LEGACY_TIMEOUT_MS = 60_000;

function usesDefaultNoTimeout(nodeType: string): boolean {
  return nodeType === 'code' || nodeType === 'executeCommand';
}

function numberParamDisplayValue(
  parameters: Record<string, unknown>,
  field: ParamField,
): string {
  const raw = parameters[field.key];
  if (field.key === 'timeoutMs') {
    if (raw === LEGACY_TIMEOUT_MS || raw === '60000') {
      return '-1';
    }
  }
  if (raw === undefined || raw === null || raw === '') {
    return field.default ?? '';
  }
  return String(raw);
}

function stringParamDisplayValue(
  parameters: Record<string, unknown>,
  field: ParamField,
): string {
  const raw = parameters[field.key];
  if (raw === undefined || raw === null || raw === '') {
    return field.default ?? '';
  }
  return String(raw);
}

function syncLlmBaseUrlForProvider(
  parameters: Record<string, unknown>,
  provider: string,
): Record<string, unknown> {
  const next = { ...parameters, provider };
  if (provider === 'openai-compatible') {
    next.baseUrl = '';
    return next;
  }
  if (!String(parameters.baseUrl ?? '').trim()) {
    next.baseUrl = DEFAULT_OLLAMA_URL;
  }
  return next;
}

function shouldNormalizeTimeoutMs(nodeType: string, raw: unknown): boolean {
  if (!usesDefaultNoTimeout(nodeType)) return false;
  if (raw === -1 || raw === '-1') return false;
  return (
    raw === undefined ||
    raw === null ||
    raw === '' ||
    raw === LEGACY_TIMEOUT_MS ||
    raw === '60000'
  );
}

function shouldShowParamField(
  node: WorkflowNode,
  f: ParamField,
  definition: WorkflowDefinition,
): boolean {
  if (isFixedCapabilityToolType(node.type) && f.key === 'toolDescription') {
    return false;
  }
  if (node.type === 'toolWorkflow' && f.key === 'workflowId') {
    return false;
  }
  if (node.type === 'mcpClient' || node.type === 'toolMcp') {
    return f.key === 'toolDescription';
  }
  if (
    node.type === 'aiChatModel' &&
    f.key === 'credentialId' &&
    String(node.parameters.provider ?? 'ollama') === 'openai-compatible'
  ) {
    return false;
  }
  if (
    node.type === 'aiChatModel' &&
    f.key === 'baseUrl' &&
    String(node.parameters.provider ?? 'ollama') === 'openai-compatible'
  ) {
    return false;
  }
  if (
    node.type === 'crewSupervisor' &&
    f.key === 'supervisorCredentialId' &&
    String(node.parameters.supervisorProvider ?? 'ollama') === 'openai-compatible'
  ) {
    return false;
  }
  if (node.type === 'skillRun') {
    const src = String(node.parameters.skillSource ?? 'path');
    if (f.key === 'skillPath' && src !== 'path') return false;
    if (f.key === 'skillId') return false;
    if (f.key === 'workspaceRoot' && src === 'registry') return false;
  }
  if (
    (node.type === 'llm' || node.type === 'llmStream') &&
    f.key === 'credentialId' &&
    String(node.parameters.provider ?? 'ollama') !== 'openai-compatible'
  ) {
    return false;
  }
  if (node.type === 'workflow_run') {
    if (
      f.key === 'workflowRelPath' ||
      f.key === 'workflowId' ||
      f.key === 'workflowSource' ||
      f.key === 'workspaceRoot' ||
      f.key === 'expandTemplate'
    ) {
      return false;
    }
  }
  if (
    f.key === 'enableBuiltinTools' &&
    (node.type === 'crewSequential' ||
      node.type === 'crewHierarchical' ||
      node.type === 'crewSupervisor') &&
    String(node.parameters.executionBackend ?? 'native') !== 'crewai'
  ) {
    return false;
  }
  if (
    (f.key === 'crewaiFlowMode' || f.key === 'enableEval') &&
    (node.type === 'crewSequential' ||
      node.type === 'crewHierarchical' ||
      node.type === 'crewSupervisor') &&
    String(node.parameters.executionBackend ?? 'native') !== 'crewai'
  ) {
    return false;
  }
  if (
    f.key === 'flowRouter' &&
    node.type === 'crewSequential' &&
    (String(node.parameters.executionBackend ?? 'native') !== 'crewai' ||
      String(node.parameters.crewaiFlowMode ?? 'crew') !== 'flow')
  ) {
    return false;
  }
  if (node.type === 'readWriteFile' && f.key === 'content') {
    const op = String(node.parameters.operation ?? 'read').toLowerCase();
    return op === 'write' || op === 'append';
  }
  if (node.type === 'readWriteFile' && f.key === 'binaryPropertyName') {
    const op = String(node.parameters.operation ?? 'read').toLowerCase();
    return op === 'readbinary' || op === 'writebinary' || op === 'write';
  }
  if (
    node.type === 'aiAgent' &&
    !isCrewEditorEnabled(definition.settings) &&
    AI_AGENT_CREW_PARAM_KEYS.has(f.key)
  ) {
    return false;
  }
  return true;
}

export function NodeEditorParamsPane({
  definition,
  node,
  workflowId,
  publicUrl,
  published,
  nodeDebug,
  webhookListenError,
  onUpdateNode,
  onExecuteNode,
  jsonDrafts,
  onJsonDraftChange,
  jsonError,
  workflowRunnerPolicy,
  runnerOptions,
  onReplaceWorkflowDefinition,
  onPatchWorkflowDefinition,
}: {
  definition: WorkflowDefinition;
  node: WorkflowNode;
  workflowId: string;
  publicUrl: string;
  published: boolean;
  nodeDebug: Record<string, NodeDebugState>;
  webhookListenError?: WebhookListenError;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onExecuteNode: ExecuteNodeFn;
  jsonDrafts: Record<string, string>;
  onJsonDraftChange: (key: string, text: string) => void;
  jsonError: string | null;
  workflowRunnerPolicy: RunnerPolicy;
  runnerOptions: RunnerOption[];
  onReplaceWorkflowDefinition?: (definition: WorkflowDefinition) => void;
  onPatchWorkflowDefinition?: (
    updater: (definition: WorkflowDefinition) => WorkflowDefinition,
  ) => void;
}) {
  const labels = useLabels();
  const basicFields = getBasicParamSchema(node.type).filter((f) =>
    shouldShowParamField(node, f, definition),
  );
  const { paramsFields, crewFields } = splitAgentParamFields(node, basicFields, definition);
  const showCrewTab = crewFields.length > 0;
  const settingsFields = getSettingsParamSchema(node.type).filter((f) =>
    shouldShowParamField(node, f, definition),
  );
  const debug = nodeDebug[node.id];
  const canExecuteFromTrigger =
    findMainFlowTriggerOnPath(definition, node.id) != null;
  const showRunnerSettings = nodeSupportsRunnerOverride(node.type);
  const showSettingsTab = settingsFields.length > 0 || showRunnerSettings;
  const [paramsTab, setParamsTab] = useState<ParamsTab>('params');
  const [registryWorkspaceRoot, setRegistryWorkspaceRoot] = useState('');

  useEffect(() => {
    setParamsTab('params');
  }, [node.id]);

  useEffect(() => {
    if (paramsTab === 'crew' && !showCrewTab) {
      setParamsTab('params');
    }
  }, [paramsTab, showCrewTab]);

  useEffect(() => {
    if (paramsTab === 'settings' && !showSettingsTab) {
      setParamsTab('params');
    }
  }, [paramsTab, showSettingsTab]);

  useEffect(() => {
    if (node.type !== 'skillRun') return;
    if (String(node.parameters.skillSource ?? 'path') !== 'registry') return;
    void api.rxwfWorkspace.get().then((r) => setRegistryWorkspaceRoot(r.workspaceRoot)).catch(() => {
      setRegistryWorkspaceRoot('');
    });
  }, [node.type, node.parameters.skillSource]);

  useEffect(() => {
    if (!shouldNormalizeTimeoutMs(node.type, node.parameters.timeoutMs)) return;
    onUpdateNode(node.id, {
      parameters: { ...node.parameters, timeoutMs: -1 },
    });
  }, [node.id, node.type, node.parameters.timeoutMs, onUpdateNode]);

  useEffect(() => {
    if (node.type !== 'llm' && node.type !== 'llmStream' && node.type !== 'aiChatModel') return;
    const provider = String(node.parameters.provider ?? 'ollama');
    const baseUrlStr = String(node.parameters.baseUrl ?? '').trim();

    if (provider === 'ollama') {
      if (!baseUrlStr) {
        onUpdateNode(node.id, {
          parameters: { ...node.parameters, baseUrl: DEFAULT_OLLAMA_URL },
        });
      }
      return;
    }

    if (baseUrlStr === DEFAULT_OLLAMA_URL) {
      onUpdateNode(node.id, {
        parameters: { ...node.parameters, baseUrl: '' },
      });
    }
  }, [node.id, node.type, node.parameters.baseUrl, node.parameters.provider, onUpdateNode]);

  const setParam = (key: string, raw: string, type: ParamField['type']) => {
    let value: unknown = raw;
    if (type === 'number') {
      value = raw === '' ? undefined : Number(raw);
    } else if (type === 'json') {
      return;
    }
    onUpdateNode(node.id, {
      parameters: { ...node.parameters, [key]: value },
    });
  };

  const updateParameters = (parameters: Record<string, unknown>) => {
    onUpdateNode(node.id, { parameters });
  };

  const renderParamFields = (fields: ParamField[]) => {
    if (fields.length === 0) {
      return null;
    }
    return fields.map((f) => {
      const ollamaModelField = resolveOllamaModelField(node, f);
      if (node.type === 'skillRun' && f.key === 'skillPath') {
        return (
          <SkillPathParamField
            key={f.key}
            label={resolveLabel(labels, f.label)}
            value={String(node.parameters.skillPath ?? '')}
            workspaceRoot={String(node.parameters.workspaceRoot ?? '')}
            placeholder={f.placeholder}
            onValueChange={(v) => setParam(f.key, v, f.type)}
          />
        );
      }
      if (ollamaModelField) {
        return (
          <OllamaModelParamField
            key={f.key}
            label={resolveLabel(labels, f.label)}
            value={String(node.parameters[f.key] ?? '')}
            baseUrl={ollamaModelField.baseUrl}
            liveOnly={ollamaModelField.liveOnly}
            fetchOnFocus={ollamaModelField.fetchOnFocus}
            placeholder={
              f.placeholder ??
              (f.allowFromAi
                ? '{{ $fromAI("key", "description", "string") }}'
                : '{{ $json.id }}')
            }
            onValueChange={(v) => setParam(f.key, v, f.type)}
          />
        );
      }
      if (
        (node.type === 'llm' || node.type === 'llmStream') &&
        f.key === 'credentialId'
      ) {
        return (
          <CredentialSelect
            key={f.key}
            value={String(node.parameters.credentialId ?? '')}
            onChange={(credentialId) =>
              updateParameters({ ...node.parameters, credentialId })
            }
            acceptedTypes={['apiKey', 'oauth2Manual']}
          />
        );
      }
      if (isStringFieldType(f.type) && !f.plainText) {
        return (
          <ParamTemplateField
            key={f.key}
            label={resolveLabel(labels, f.label)}
            value={stringParamDisplayValue(node.parameters, f)}
            className={node.type === 'if' && f.key === 'condition' ? 'if-condition-form-field' : undefined}
            multiline={f.type === 'textarea' || f.type === 'expression'}
            placeholder={
              f.placeholder ??
              (f.allowFromAi
                ? '{{ $fromAI("key", "description", "string") }}'
                : '{{ $json.id }}')
            }
            onValueChange={(v) => setParam(f.key, v, f.type)}
          />
        );
      }
      if (f.type === 'javascript') {
        return (
          <FormField
            key={f.key}
            label={resolveLabel(labels, f.label)}
            className={node.type === 'code' ? 'code-js-form-field' : undefined}
          >
            <CodeJsEditor
              value={stringParamDisplayValue(node.parameters, f)}
              placeholder={f.placeholder}
              onChange={(v) => setParam(f.key, v, f.type)}
            />
          </FormField>
        );
      }
      if (f.type === 'json') {
        return (
          <FormField key={f.key} label={resolveLabel(labels, f.label)} className="json-param-form-field">
            <JsonParamEditor
              value={jsonDrafts[f.key] ?? formatJsonParamValue(node.parameters[f.key])}
              placeholder={f.placeholder}
              onChange={(text) => onJsonDraftChange(f.key, text)}
            />
            {jsonError && (
              <p className="form-error rxwf-mt-1">
                {jsonError}
              </p>
            )}
          </FormField>
        );
      }
      if (isStringFieldType(f.type) && f.plainText) {
        return (
          <FormField key={f.key} label={resolveLabel(labels, f.label)}>
            <textarea
              rows={8}
              spellCheck={false}
              placeholder={f.placeholder}
              value={stringParamDisplayValue(node.parameters, f)}
              onChange={(e) => setParam(f.key, e.target.value, f.type)}
            />
          </FormField>
        );
      }
      return (
        <FormField key={f.key} label={resolveLabel(labels, f.label)}>
          {f.type === 'select' ? (
            <Select
              value={String(node.parameters[f.key] ?? f.default ?? f.options?.[0] ?? '')}
              onChange={(next) => {
                if (
                  f.key === 'provider' &&
                  (node.type === 'llm' || node.type === 'llmStream' || node.type === 'aiChatModel')
                ) {
                  updateParameters(syncLlmBaseUrlForProvider(node.parameters, next));
                  return;
                }
                setParam(f.key, next, f.type);
              }}
              options={(f.options ?? []).map((opt) => ({
                value: opt,
                label: f.optionLabelKeys?.[opt]
                  ? providerOptionLabel(labels, opt, f.optionLabelKeys[opt])
                  : formatSelectOptionLabel(opt),
              }))}
            />
          ) : f.type === 'number' ? (
            <NumberInput
              value={numberParamDisplayValue(node.parameters, f)}
              placeholder={f.placeholder ? resolveLabel(labels, f.placeholder) : undefined}
              onChange={(v) => setParam(f.key, v, f.type)}
              stepUpAriaLabel={t(labels, 'common.increase')}
              stepDownAriaLabel={t(labels, 'common.decrease')}
            />
          ) : (
            <input
              type="text"
              placeholder={f.placeholder}
              value={stringParamDisplayValue(node.parameters, f)}
              onChange={(e) => setParam(f.key, e.target.value, f.type)}
            />
          )}
        </FormField>
      );
    });
  };

  const paramsTabEmpty =
    paramsFields.length === 0 &&
    node.type !== 'mcpClient' &&
    node.type !== 'toolMcp' &&
    node.type !== 'switch' &&
    node.type !== 'subworkflowTrigger' &&
    node.type !== 'toolWorkflow' &&
    node.type !== 'executeWorkflow' &&
    node.type !== 'executeCommand' &&
    node.type !== 'aiKnowledge' &&
    node.type !== 'webhookTrigger';

  const paramsPanelContent =
    paramsTab === 'settings' ? (
      <>
        {showRunnerSettings && (
          <RunnerCompactEditor
            variant="node"
            node={node}
            workflowRunnerPolicy={workflowRunnerPolicy}
            runners={runnerOptions}
            onChange={(override) => {
              onUpdateNode(node.id, nodeRunnerOverrideToNodePatch(override));
            }}
          />
        )}
        {renderParamFields(settingsFields)}
      </>
    ) : paramsTab === 'crew' ? (
      renderParamFields(crewFields)
    ) : (
      <>
        {node.type === 'webhookTrigger' && workflowId !== 'new' && (
          <WebhookTriggerPanel
            workflowId={workflowId}
            node={node}
            publicUrl={publicUrl}
            published={published}
            isListening={debug?.status === 'waiting'}
            listenError={webhookListenError}
            onUpdateNode={onUpdateNode}
          />
        )}

        {node.type === 'httpRequest' && (
          <>
            {renderParamFields(paramsFields.filter((f) => f.key === 'method'))}
            {renderParamFields(paramsFields.filter((f) => f.key === 'url'))}
            <CredentialSelect
              value={String(node.parameters.credentialId ?? '')}
              onChange={(credentialId) =>
                updateParameters({ ...node.parameters, credentialId })
              }
              acceptedTypes={['apiKey', 'httpHeaderAuth', 'basicAuth', 'oauth2Manual']}
            />
            <HttpRequestAdvancedFields
              parameters={node.parameters}
              onChange={(next) => updateParameters(next)}
            />
          </>
        )}

        {node.type === 'executeCommand' && (
          <ExecuteCommandFields
            command={String(node.parameters.command ?? '')}
            args={node.parameters.args}
            cwd={String(node.parameters.cwd ?? '')}
            onChange={(patch) => updateParameters({ ...node.parameters, ...patch })}
          />
        )}

        {(node.type === 'aiKnowledge' ||
          node.type === 'ragRetrieve' ||
          node.type === 'ragAnswer') && (
          <KnowledgeBaseIdsField
            value={node.parameters.knowledgeBaseIds}
            onChange={(knowledgeBaseIds) =>
              updateParameters({ ...node.parameters, knowledgeBaseIds })
            }
          />
        )}

        {node.type === 'aiChatModel' &&
          String(node.parameters.provider ?? 'ollama') === 'openai-compatible' && (
            <CredentialSelect
              value={String(node.parameters.credentialId ?? '')}
              onChange={(credentialId) =>
                updateParameters({ ...node.parameters, credentialId })
              }
              acceptedTypes={['apiKey', 'oauth2Manual']}
            />
          )}

        {node.type === 'crewSupervisor' &&
          String(node.parameters.supervisorProvider ?? 'ollama') === 'openai-compatible' && (
            <CredentialSelect
              value={String(node.parameters.supervisorCredentialId ?? '')}
              onChange={(supervisorCredentialId) =>
                updateParameters({ ...node.parameters, supervisorCredentialId })
              }
              acceptedTypes={['apiKey', 'oauth2Manual']}
            />
          )}

        {node.type === 'skillRun' &&
          String(node.parameters.skillSource ?? 'path') === 'registry' && (
            <>
              <FormField label={t(labels, 'rxwf.workspaceRoot')}>
                <input readOnly value={registryWorkspaceRoot} placeholder="—" />
              </FormField>
              <SkillRegistrySelect
                value={String(node.parameters.skillId ?? '')}
                onChange={(skillId) =>
                  updateParameters({ ...node.parameters, skillId })
                }
              />
            </>
          )}

        {node.type === 'switch' && onPatchWorkflowDefinition && (
          <SwitchBranchesPanel
            node={node}
            onUpdateParameters={updateParameters}
            onPatchWorkflow={onPatchWorkflowDefinition}
          />
        )}

        {node.type === 'workflow_run' && (
          <WorkflowRunFields
            parameters={node.parameters}
            workspaceRoot={String(node.parameters.workspaceRoot ?? '')}
            onChange={(next) => updateParameters(next)}
            onReplaceDefinition={onReplaceWorkflowDefinition}
          />
        )}

        {node.type === 'subworkflowTrigger' && (
          <SubworkflowTriggerFields
            parameters={node.parameters}
            onChange={(next) => updateParameters(next)}
          />
        )}

        {node.type === 'toolWorkflow' && (
          <>
            <ToolWorkflowSelect
              value={String(node.parameters.workflowId ?? '')}
              currentWorkflowId={workflowId !== 'new' ? workflowId : undefined}
              onChange={(id) =>
                updateParameters({ ...node.parameters, workflowId: id })
              }
            />
            <SubworkflowInputMappingFields
              workflowId={String(node.parameters.workflowId ?? '')}
              mapping={
                (node.parameters.inputMapping as Record<string, unknown> | undefined) ?? {}
              }
              onChange={(inputMapping) =>
                updateParameters({ ...node.parameters, inputMapping })
              }
            />
          </>
        )}

        {node.type === 'executeWorkflow' && (
          <SubworkflowInputMappingFields
            workflowId={String(node.parameters.workflowId ?? '')}
            mapping={
              (node.parameters.inputMapping as Record<string, unknown> | undefined) ?? {}
            }
            onChange={(inputMapping) =>
              updateParameters({ ...node.parameters, inputMapping })
            }
          />
        )}

        {isFixedCapabilityToolType(node.type) && (
          <BuiltinSatelliteToolDescription nodeType={node.type} />
        )}

        {(node.type === 'mcpClient' || node.type === 'toolMcp') && (
          <McpClientFields
            serverId={String(node.parameters.serverId ?? '')}
            selectedTools={normalizeMcpTools(node.parameters)}
            onChange={(patch) => {
              const next: Record<string, unknown> = { ...node.parameters, ...patch };
              if (patch.tools !== undefined) delete next.tool;
              onUpdateNode(node.id, { parameters: next });
            }}
          />
        )}

        {paramsTabEmpty && !isFixedCapabilityToolType(node.type) ? (
          <p className="hint">{t(labels, 'editor.noEditableParams')}</p>
        ) : (
          renderParamFields(
            (() => {
              if (
                node.type === 'httpRequest' ||
                node.type === 'executeCommand' ||
                node.type === 'workflow_run' ||
                node.type === 'switch' ||
                node.type === 'subworkflowTrigger' ||
                node.type === 'toolWorkflow' ||
                node.type === 'webhookTrigger'
              ) {
                return [];
              }
              if (node.type === 'executeWorkflow') {
                return paramsFields.filter((f) => f.key === 'workflowId');
              }
              if (node.type === 'skillRun') {
                return paramsFields.filter((f) => f.key !== 'skillId');
              }
              return paramsFields;
            })(),
          )
        )}
      </>
    );

  return (
    <div className="node-editor-pane node-editor-params-pane">
      <div className="node-editor-pane-head">
        <div className="node-editor-params-tabs--head" role="tablist">
          <button
            type="button"
            role="tab"
            className={`node-editor-params-tab--head${paramsTab === 'params' ? ' is-active' : ''}`}
            aria-selected={paramsTab === 'params'}
            onClick={() => setParamsTab('params')}
          >
            {t(labels, 'editor.tab.params')}
          </button>
          {showCrewTab && (
            <button
              type="button"
              role="tab"
              className={`node-editor-params-tab--head${paramsTab === 'crew' ? ' is-active' : ''}`}
              aria-selected={paramsTab === 'crew'}
              onClick={() => setParamsTab('crew')}
            >
              {t(labels, 'editor.tab.crew')}
            </button>
          )}
          {showSettingsTab && (
            <button
              type="button"
              role="tab"
              className={`node-editor-params-tab--head${paramsTab === 'settings' ? ' is-active' : ''}`}
              aria-selected={paramsTab === 'settings'}
              onClick={() => setParamsTab('settings')}
            >
              {t(labels, 'editor.tab.settings')}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn-execute-node"
          disabled={
            debug?.status === 'running' ||
            (debug?.status !== 'waiting' && !canExecuteFromTrigger)
          }
          title={
            canExecuteFromTrigger || debug?.status === 'waiting'
              ? undefined
              : t(labels, 'editor.requiresTriggerNode')
          }
          onClick={() => onExecuteNode(node.id)}
        >
          {debug?.status === 'running'
            ? t(labels, 'auto.t_666b4aff')
            : debug?.status === 'waiting'
              ? t(labels, 'webhook.cancelListen')
              : t(labels, 'auto.t_6ed9672c')}
        </button>
      </div>

      <div
        className={`node-editor-pane-body${paramsTab === 'settings' ? ' node-editor-pane-body--settings' : ''}`}
      >
        <div className="node-editor-params-tab-panel" role="tabpanel">
          {paramsPanelContent}
        </div>
      </div>
    </div>
  );
}
