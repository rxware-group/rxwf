import { useEffect, useRef, useState } from 'react';
import type { NodeOutputPreview } from './editor-debug-types.js';
import { t, useLabels } from '../../i18n/labels.js';
import { Select } from '../../components/Select.js';
import { formatJsonData, JsonDataViewer } from './JsonDataViewer.js';
import { HtmlBodyPreview } from './HtmlBodyPreview.js';
import { HtmlDataViewer } from './HtmlDataViewer.js';
import { resolveHttpOutputBodyPreview } from './http-response-display.js';
import {
  HTTP_RESPONSE_BODY_CONTENT_TYPES,
  HTTP_RESPONSE_BINARY_MODES,
  normalizeHttpResponseBodyContentType,
  normalizeHttpResponseBinaryMode,
  type HttpResponseBodyContentType,
  type HttpResponseBinaryMode,
} from './http-request-types.js';
import { TextDataViewer } from './TextDataViewer.js';
import { useVerticalSplitter } from './use-vertical-splitter.js';

export function HttpOutputPreview({
  preview,
  parameters,
  onParametersChange,
}: {
  preview: NodeOutputPreview;
  parameters: Record<string, unknown>;
  onParametersChange: (patch: Record<string, unknown>) => void;
}) {
  const labels = useLabels();
  const containerRef = useRef<HTMLDivElement>(null);
  const { topPct, startDrag } = useVerticalSplitter(55);
  const [htmlPreview, setHtmlPreview] = useState(false);
  const responseBodyContentType = normalizeHttpResponseBodyContentType(
    parameters.responseBodyContentType,
  );
  const responseBinaryMode = normalizeHttpResponseBinaryMode(
    parameters.responseBinaryMode,
  );

  useEffect(() => {
    if (responseBodyContentType !== 'html') {
      setHtmlPreview(false);
    }
  }, [responseBodyContentType]);

  if (preview.kind !== 'single') {
    return null;
  }

  const bodyPreview = resolveHttpOutputBodyPreview(preview.data, parameters);
  const showHtmlPreview = bodyPreview.contentType === 'html' && htmlPreview;

  const bodyViewer = (() => {
    if (bodyPreview.contentType === 'json') {
      return <JsonDataViewer value={bodyPreview.text} />;
    }
    if (bodyPreview.contentType === 'html') {
      return showHtmlPreview ? (
        <HtmlBodyPreview html={bodyPreview.text} />
      ) : (
        <HtmlDataViewer value={bodyPreview.text} />
      );
    }
    return <TextDataViewer value={bodyPreview.text} />;
  })();

  return (
    <div className="http-output-preview" ref={containerRef}>
      <section
        className="http-output-preview-section http-output-preview-section--json"
        style={{ height: `${topPct}%` }}
      >
        <div className="http-output-preview-section-body">
          <JsonDataViewer value={formatJsonData(preview.data)} />
        </div>
      </section>
      <div
        className="http-output-preview-splitter editor-log-splitter editor-log-splitter--row"
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={(e) => startDrag(e, containerRef.current)}
      />
      <section className="http-output-preview-section http-output-preview-section--body">
        <h5 className="http-output-preview-section-title">
          <span>{t(labels, 'editor.http.outputBody')}</span>
          <div className="http-output-preview-body-actions">
            <div className="http-output-preview-body-type-select">
              <Select
                value={responseBinaryMode}
                aria-label={t(labels, 'editor.http.responseBinaryMode')}
                onChange={(value) =>
                  onParametersChange({
                    responseBinaryMode: value as HttpResponseBinaryMode,
                  })
                }
                options={HTTP_RESPONSE_BINARY_MODES.map((value) => ({
                  value,
                  label: t(labels, `editor.http.responseBinaryMode.${value}`),
                }))}
              />
            </div>
            <div className="http-output-preview-body-type-select">
              <Select
                value={responseBodyContentType}
                aria-label={t(labels, 'editor.http.responseBodyContentType')}
                onChange={(value) =>
                  onParametersChange({
                    responseBodyContentType: value as HttpResponseBodyContentType,
                  })
                }
                options={HTTP_RESPONSE_BODY_CONTENT_TYPES.map((value) => ({
                  value,
                  label: t(labels, `editor.http.responseBodyContentType.${value}`),
                }))}
              />
            </div>
            {responseBodyContentType === 'html' ? (
              <span className="field-mode-toggle http-output-html-preview-toggle">
                <button
                  type="button"
                  className={htmlPreview ? 'active' : ''}
                  onClick={() => setHtmlPreview((value) => !value)}
                >
                  {t(labels, 'editor.http.outputBodyPreview')}
                </button>
              </span>
            ) : null}
          </div>
        </h5>
        <div className="http-output-preview-section-body">
          {!bodyPreview.text ? (
            <div className="http-output-preview-empty">
              <p className="hint">{t(labels, 'editor.http.outputBodyEmpty')}</p>
            </div>
          ) : (
            bodyViewer
          )}
        </div>
      </section>
    </div>
  );
}
