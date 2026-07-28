import { t, useLabels } from '../../i18n/labels.js';
import { Select } from '../../components/Select.js';
import { JsonParamEditor } from './JsonParamEditor.js';

import { HttpKeyValueTable } from './HttpKeyValueTable.js';

import {
  HTTP_BODY_CONTENT_TYPES,
  HTTP_RAW_BODY_CONTENT_TYPES,
  normalizeHttpBodyContentType,
  normalizeHttpKeyValueRows,
  normalizeHttpRawBodyContentType,
  type HttpBodyContentType,
  type HttpKeyValueRow,
  type HttpRawBodyContentType,
} from './http-request-types.js';



const DEFAULT_GRAPHQL_BODY = '{\n  "query": ""\n}';



export function HttpBodyEditor({

  bodyContentType,

  rawContentType,

  body,

  bodyParameters,

  onChange,

}: {

  bodyContentType: HttpBodyContentType | 'json';

  rawContentType?: HttpRawBodyContentType;

  body: string;

  bodyParameters: HttpKeyValueRow[];

  onChange: (patch: {

    bodyContentType?: HttpBodyContentType;

    rawContentType?: HttpRawBodyContentType;

    body?: string;

    bodyParameters?: HttpKeyValueRow[];

  }) => void;

}) {

  const labels = useLabels();

  const contentType = normalizeHttpBodyContentType(bodyContentType);

  const rawType = normalizeHttpRawBodyContentType(rawContentType, bodyContentType);

  const bodyTypeGroupName = 'http-body-content-type';



  const handleBodyTypeChange = (nextType: HttpBodyContentType) => {

    const patch: {

      bodyContentType: HttpBodyContentType;

      rawContentType?: HttpRawBodyContentType;

      body?: string;

    } = { bodyContentType: nextType };

    if (nextType === 'raw') {
      patch.rawContentType = 'json';
    }

    if (nextType === 'graphql' && !body.trim()) {

      patch.body = DEFAULT_GRAPHQL_BODY;

    }

    onChange(patch);

  };



  return (

    <div className="http-body-editor">

      <div

        className="http-body-type-radios"

        role="radiogroup"

        aria-label={t(labels, 'editor.http.bodyType')}

      >

        {HTTP_BODY_CONTENT_TYPES.map((value) => (
          <label key={value} className="http-body-type-radio">
            <input
              type="radio"
              name={bodyTypeGroupName}
              value={value}
              checked={contentType === value}
              onChange={() => handleBodyTypeChange(value)}
            />
            <span>{t(labels, `editor.http.bodyType.${value}`)}</span>
          </label>
        ))}
        {contentType === 'raw' ? (
          <div className="http-body-raw-type-select">
            <Select
              value={rawType}
              aria-label={t(labels, 'editor.http.rawContentType')}
              onChange={(nextValue) =>
                onChange({ rawContentType: nextValue as HttpRawBodyContentType })
              }
              options={HTTP_RAW_BODY_CONTENT_TYPES.map((rawValue) => ({
                value: rawValue,
                label: t(labels, `editor.http.rawContentType.${rawValue}`),
              }))}
            />
          </div>
        ) : null}

      </div>



      {contentType === 'form-data' || contentType === 'x-www-form-urlencoded' ? (

        <HttpKeyValueTable

          rows={normalizeHttpKeyValueRows(bodyParameters)}

          onChange={(rows) => onChange({ bodyParameters: rows })}

        />

      ) : null}



      {contentType === 'raw' ? (
        <>
          {rawType === 'json' ? (

            <div className="http-body-json">

              <JsonParamEditor

                value={body}

                placeholder='{"key": "value"}'

                onChange={(next) => onChange({ body: next })}

              />

            </div>

          ) : (

            <textarea

              className="http-body-raw"

              value={body}

              rows={6}

              placeholder={t(labels, 'editor.http.bodyRawPlaceholder')}

              onChange={(e) => onChange({ body: e.target.value })}

            />

          )}

        </>

      ) : null}



      {contentType === 'binary' ? (

        <textarea

          className="http-body-raw"

          value={body}

          rows={6}

          placeholder={t(labels, 'editor.http.bodyBinaryPlaceholder')}

          onChange={(e) => onChange({ body: e.target.value })}

        />

      ) : null}

      {contentType === 'binaryFromItem' ? (
        <p className="hint">{t(labels, 'editor.http.bodyBinaryFromItemHint')}</p>
      ) : null}



      {contentType === 'graphql' ? (

        <div className="http-body-json">

          <JsonParamEditor

            value={body || DEFAULT_GRAPHQL_BODY}

            placeholder={DEFAULT_GRAPHQL_BODY}

            onChange={(next) => onChange({ body: next })}

          />

        </div>

      ) : null}

    </div>

  );

}


