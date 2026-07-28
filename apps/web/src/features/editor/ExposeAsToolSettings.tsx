import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';

export function ExposeAsToolSettings({
  exposeAsTool,
  description,
  onChange,
}: {
  exposeAsTool: boolean;
  description: string;
  onChange: (patch: { exposeAsTool?: boolean; exposeAsToolDescription?: string }) => void;
}) {
  const labels = useLabels();
  return (
    <div className="expose-as-tool-settings">
      <FormField label={t(labels, 'auto.Agent_Tool_362871e1')}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={exposeAsTool}
            onChange={(e) => onChange({ exposeAsTool: e.target.checked })}
          />
          <span>{t(labels, 'editor.exposeAsToolHint')}</span>
        </label>
      </FormField>
      {exposeAsTool && (
        <FormField label={t(labels, 'auto.Tool_c2975baf')}>
          <textarea
            rows={3}
            placeholder={t(labels, 'auto.Agent_ecd24bc6')}
            value={description}
            onChange={(e) => onChange({ exposeAsToolDescription: e.target.value })}
          />
        </FormField>
      )}
    </div>
  );
}
