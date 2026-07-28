import { t, useLabels } from '../../../i18n/labels.js';
import type { WorkflowDefinition } from '../../../api/client.js';
import { ParamTemplateField } from '../ParamTemplateField.js';

type WorkflowNode = WorkflowDefinition['nodes'][number];

type N8nConditionRow = {
  left?: string;
};

export type IfValidationIssue = {
  code: 'E2003';
  message: string;
};

function resolveConditionText(parameters: Record<string, unknown>): string {
  const direct = String(parameters.condition ?? '').trim();
  if (direct) return direct;

  const rows = parameters.conditions;
  if (Array.isArray(rows) && rows.length > 0) {
    const first = rows[0] as N8nConditionRow;
    return String(first.left ?? '').trim();
  }

  return '';
}

function normalizeConditionTemplate(condition: string): string {
  const trimmed = condition.trim();
  if (trimmed.startsWith('={{') && trimmed.endsWith('}}')) {
    return `{{ ${trimmed.slice(2, -2).trim()} }}`;
  }
  return trimmed;
}

function isExpressionTemplate(template: string): boolean {
  const value = template.trim();
  return value.startsWith('{{') && value.endsWith('}}');
}

export function validateIfParameters(
  parameters: Record<string, unknown>,
): IfValidationIssue | null {
  const legacyField = String(parameters.field ?? '').trim();
  if (legacyField) return null;

  const condition = resolveConditionText(parameters);
  if (!condition) {
    return {
      code: 'E2003',
      message: 'if requires a non-empty {{ }} condition expression',
    };
  }

  const template = normalizeConditionTemplate(condition);
  if (!isExpressionTemplate(template)) {
    return {
      code: 'E2003',
      message: 'if condition must be a {{ }} expression',
    };
  }

  return null;
}

export function IfConditionPanel({
  node,
  onUpdateParameters,
}: {
  node: WorkflowNode;
  onUpdateParameters: (next: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const condition = String(node.parameters.condition ?? '');

  return (
    <div className="if-condition-panel">
      <ParamTemplateField
        label={t(labels, 'editor.if.condition')}
        value={condition}
        className="if-condition-form-field"
        multiline
        placeholder="{{ $json.active === true }}"
        onValueChange={(v) => onUpdateParameters({ ...node.parameters, condition: v })}
      />
    </div>
  );
}
