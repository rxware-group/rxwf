import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';

export function EnableCrewSettings({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const labels = useLabels();
  return (
    <div className="enable-crew-settings">
      <FormField label={t(labels, 'editor.settings.enableCrew')}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{t(labels, 'editor.settings.enableCrewHint')}</span>
        </label>
      </FormField>
    </div>
  );
}
