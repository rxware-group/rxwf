import { t, useLabels } from '../../i18n/labels.js';
import { FormField } from '../../components/FormField.js';
import { ParamTemplateField } from './ParamTemplateField.js';
import { normalizeExecuteCommandArgs } from './execute-command-types.js';

export function ExecuteCommandFields({
  command,
  args,
  cwd,
  onChange,
}: {
  command: string;
  args: unknown;
  cwd: string;
  onChange: (patch: { command?: string; args?: string[]; cwd?: string }) => void;
}) {
  const labels = useLabels();
  const argRows = normalizeExecuteCommandArgs(args);

  const setArgs = (next: string[]) => {
    onChange({ args: next });
  };

  const updateArg = (index: number, value: string) => {
    const next = [...argRows];
    next[index] = value;
    setArgs(next);
  };

  const removeArg = (index: number) => {
    setArgs(argRows.filter((_, i) => i !== index));
  };

  return (
    <>
      <ParamTemplateField
        label={t(labels, 'editor.executeCommand.command')}
        value={command}
        placeholder={t(labels, 'editor.executeCommand.commandPlaceholder')}
        onValueChange={(value) => onChange({ command: value })}
      />
      <FormField label={t(labels, 'editor.executeCommand.args')}>
        <div className="command-args-editor">
          {argRows.length > 0 && (
            <ul className="command-args-list">
              {argRows.map((arg, index) => (
                <li key={index} className="command-arg-row">
                  <textarea
                    className="param-field-mode-editor param-template-field command-arg-input"
                    rows={2}
                    spellCheck={false}
                    placeholder={t(labels, 'editor.executeCommand.argPlaceholder')}
                    value={arg}
                    onChange={(e) => updateArg(index, e.target.value)}
                  />
                  <button
                    type="button"
                    className="command-arg-remove"
                    aria-label={t(labels, 'editor.executeCommand.removeArg')}
                    onClick={() => removeArg(index)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="command-arg-add"
            onClick={() => setArgs([...argRows, ''])}
          >
            {t(labels, 'editor.executeCommand.addArg')}
          </button>
        </div>
      </FormField>
      <ParamTemplateField
        label={t(labels, 'editor.executeCommand.cwd')}
        value={cwd}
        placeholder={t(labels, 'editor.executeCommand.cwdPlaceholder')}
        onValueChange={(value) => onChange({ cwd: value })}
      />
    </>
  );
}
