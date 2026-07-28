import { DEPRECATED_RULE_SOURCES, normalizeRxwfSkillPath } from '@rxwf/skill-runtime';
import { collectSatellites } from './agent-satellites.js';
import type { ValidationError, WorkflowDefinition } from './validate.js';

function skillSourceConfigured(parameters: Record<string, unknown>): boolean {
  const source = String(parameters.skillSource ?? 'path');
  if (source === 'registry') {
    return typeof parameters.skillId === 'string' && parameters.skillId.trim().length > 0;
  }
  return typeof parameters.skillPath === 'string' && parameters.skillPath.trim().length > 0;
}

export function validateSkillRunNodes(
  definition: WorkflowDefinition,
  errors: ValidationError[],
): void {
  for (const node of definition.nodes) {
    if (node.type !== 'skillRun') continue;
    const p = node.parameters;

    if (!skillSourceConfigured(p)) {
      errors.push({
        code: 'E1040',
        message: `Node ${node.name}: skillRun requires skill source (path or registry)`,
        nodeId: node.id,
      });
      continue;
    }

    const source = String(p.skillSource ?? 'path');
    if (source === 'path' && typeof p.skillPath === 'string' && p.skillPath.trim()) {
      try {
        normalizeRxwfSkillPath(p.skillPath);
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : 'E1041';
        errors.push({
          code,
          message: err instanceof Error ? err.message : String(err),
          nodeId: node.id,
        });
      }
    }

    const satellites = collectSatellites(definition, node.id);
    if (!satellites.model) {
      errors.push({
        code: 'E1043',
        message: `Node ${node.name}: skillRun requires aiChatModel satellite`,
        nodeId: node.id,
      });
    }

    const ruleSources = Array.isArray(p.ruleSources) ? (p.ruleSources as string[]) : [];
    for (const src of ruleSources) {
      if (DEPRECATED_RULE_SOURCES.has(src)) {
        errors.push({
          code: 'E1069',
          message: `Node ${node.name}: deprecated rule source "${src}"`,
          nodeId: node.id,
        });
      }
    }
    const ruleMode = String(p.ruleMode ?? 'off');
    if (ruleMode === 'explicit' && ruleSources.length === 0) {
      errors.push({
        code: 'E1046',
        message: `Node ${node.name}: ruleMode=explicit requires ruleSources`,
        nodeId: node.id,
      });
    }
  }
}

export function validateWorkflowRunNodes(
  definition: WorkflowDefinition,
  errors: ValidationError[],
): void {
  for (const node of definition.nodes) {
    if (node.type !== 'workflow_run') continue;
    const p = node.parameters;
    const source = String(p.workflowSource ?? 'template');
    if (source === 'template') {
      const rel = String(p.workflowRelPath ?? '').trim();
      if (!rel) {
        errors.push({
          code: 'E1076',
          message: `Node ${node.name}: workflow_run template source requires workflowRelPath`,
          nodeId: node.id,
        });
      }
    } else if (source === 'published') {
      const wfId = String(p.workflowId ?? '').trim();
      if (!wfId) {
        errors.push({
          code: 'E1076',
          message: `Node ${node.name}: workflow_run published source requires workflowId`,
          nodeId: node.id,
        });
      }
    } else {
      errors.push({
        code: 'E1076',
        message: `Node ${node.name}: invalid workflowSource "${source}"`,
        nodeId: node.id,
      });
    }
  }
}

export function validateToolSubagentNodes(
  definition: WorkflowDefinition,
  errors: ValidationError[],
): void {
  for (const node of definition.nodes) {
    if (node.type !== 'toolSubagent') continue;
    const p = node.parameters;
    if (!String(p.toolDescription ?? '').trim() || !String(p.systemPrompt ?? '').trim()) {
      errors.push({
        code: 'E1049',
        message: `Node ${node.name}: toolSubagent requires toolDescription and systemPrompt`,
        nodeId: node.id,
      });
    }
  }
}
