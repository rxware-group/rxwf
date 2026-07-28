import { t, useLabels } from '../../i18n/labels.js';
import { SuggestTextInput } from '../../components/SuggestTextInput.js';
import {
  filterHttpHeaderNames,
} from './http-header-names.js';
import {
  filterHttpHeaderValues,
  headerKeyHasValueSuggestions,
} from './http-header-values.js';
import {
  ensureTrailingEmptyRow,
  type HttpKeyValueRow,
} from './http-request-types.js';

export function HttpKeyValueTable({
  rows,
  onChange,
  suggestHeaders = false,
}: {
  rows: HttpKeyValueRow[];
  onChange: (rows: HttpKeyValueRow[]) => void;
  suggestHeaders?: boolean;
}) {
  const labels = useLabels();
  const displayRows = ensureTrailingEmptyRow(rows);

  const updateRow = (index: number, patch: Partial<HttpKeyValueRow>) => {
    const next = displayRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(ensureTrailingEmptyRow(next));
  };

  return (
    <div className="http-kv-table-wrap">
      <table className="http-kv-table">
        <thead>
          <tr>
            <th className="http-kv-col-check" aria-label={t(labels, 'editor.http.col.enabled')} />
            <th>{t(labels, 'editor.http.col.key')}</th>
            <th>{t(labels, 'editor.http.col.value')}</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, index) => (
            <tr key={index}>
              <td className="http-kv-col-check">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  aria-label={t(labels, 'editor.http.col.enabled')}
                  onChange={(e) => updateRow(index, { enabled: e.target.checked })}
                />
              </td>
              <td>
                {suggestHeaders ? (
                  <SuggestTextInput
                    value={row.key}
                    disabled={!row.enabled}
                    placeholder={t(labels, 'editor.http.keyPlaceholder')}
                    filterSuggestions={filterHttpHeaderNames}
                    onChange={(key) => updateRow(index, { key })}
                  />
                ) : (
                  <input
                    type="text"
                    className="http-kv-input"
                    value={row.key}
                    disabled={!row.enabled}
                    placeholder={t(labels, 'editor.http.keyPlaceholder')}
                    onChange={(e) => updateRow(index, { key: e.target.value })}
                  />
                )}
              </td>
              <td>
                {suggestHeaders && headerKeyHasValueSuggestions(row.key) ? (
                  <SuggestTextInput
                    value={row.value}
                    disabled={!row.enabled}
                    placeholder={t(labels, 'editor.http.valuePlaceholder')}
                    filterSuggestions={(query) => filterHttpHeaderValues(row.key, query)}
                    onChange={(value) => updateRow(index, { value })}
                    minPanelWidth={320}
                  />
                ) : (
                  <input
                    type="text"
                    className="http-kv-input"
                    value={row.value}
                    disabled={!row.enabled}
                    placeholder={t(labels, 'editor.http.valuePlaceholder')}
                    onChange={(e) => updateRow(index, { value: e.target.value })}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
