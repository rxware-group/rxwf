import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Select } from '../../components/Select.js';

function resolveServerId(
  raw: string,
  servers: Array<{ id: string; name: string }>,
): string {
  if (!raw) return '';
  if (servers.some((s) => s.id === raw)) return raw;
  return servers.find((s) => s.name === raw)?.id ?? raw;
}

export function McpClientFields({
  serverId,
  selectedTools,
  onChange,
}: {
  serverId: string;
  selectedTools: string[];
  onChange: (patch: { serverId?: string; tools?: string[] }) => void;
}) {
  const labels = useLabels();

  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([]);
  const [activeServerId, setActiveServerId] = useState(serverId);
  const [tools, setTools] = useState<string[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsLoadedFor, setToolsLoadedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolsHint, setToolsHint] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.mcpServers
      .list()
      .then((list) => setServers(list.map((s) => ({ id: s.id, name: s.name }))))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const resolved = resolveServerId(serverId, servers);
    setActiveServerId(resolved);
    if (resolved && resolved !== serverId && servers.some((s) => s.id === resolved)) {
      onChange({ serverId: resolved });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, servers]);

  useEffect(() => {
    if (toolsLoadedFor && toolsLoadedFor !== activeServerId) {
      setTools([]);
      setToolsLoadedFor(null);
      setToolsOpen(false);
    }
  }, [activeServerId, toolsLoadedFor]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [toolsOpen]);

  const loadTools = useCallback(
    async (id: string) => {
      setToolsLoading(true);
      setToolsHint(null);
      try {
        const list = await api.mcpServers.tools(id);
        setTools(list);
        setToolsLoadedFor(id);
      } catch (e) {
        setTools([]);
        setToolsLoadedFor(null);
        setToolsHint(e instanceof Error ? e.message : t(labels, 'auto.MCP_Server_9fef21cb'));
      } finally {
        setToolsLoading(false);
      }
    },
    [labels],
  );

  const openToolPicker = () => {
    if (!activeServerId) return;
    const nextOpen = !toolsOpen;
    setToolsOpen(nextOpen);
    if (nextOpen && toolsLoadedFor !== activeServerId) {
      void loadTools(activeServerId);
    }
  };

  const handleServerChange = (id: string) => {
    setActiveServerId(id);
    setTools([]);
    setToolsLoadedFor(null);
    setToolsOpen(false);
    onChange({ serverId: id, tools: [] });
  };

  const toggleTool = (name: string) => {
    const next = selectedTools.includes(name)
      ? selectedTools.filter((tool) => tool !== name)
      : [...selectedTools, name];
    onChange({ tools: next });
  };

  const toolButtonLabel = () => {
    if (!activeServerId) return t(labels, 'editor.mcp.selectServerFirst');
    if (selectedTools.length === 0) return t(labels, 'editor.mcp.selectTools');
    if (selectedTools.length === 1) return selectedTools[0]!;
    return t(labels, 'mcp.toolsSelected', { count: String(selectedTools.length) });
  };

  return (
    <div className="mcp-client-fields">
      {loadError && <p className="hint">{loadError}</p>}
      <FormField label="MCP Server">
        <Select
          value={activeServerId}
          onChange={handleServerChange}
          options={[
            { value: '', label: t(labels, 'editor.mcp.selectServer') },
            ...servers.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </FormField>
      <FormField label="Tool">
        <div className="mcp-tool-picker" ref={pickerRef}>
          <button
            type="button"
            className="mcp-tool-picker-trigger"
            disabled={!activeServerId}
            aria-expanded={toolsOpen}
            onClick={openToolPicker}
          >
            <span className="mcp-tool-picker-trigger-text">{toolButtonLabel()}</span>
            <span className="mcp-tool-picker-chevron" aria-hidden />
          </button>
          {toolsOpen && activeServerId && (
            <div className="mcp-tool-picker-panel" role="listbox" aria-multiselectable>
              <LoadingHost
                loading={toolsLoading}
                label={t(labels, 'editor.mcp.loadingFromServer')}
              >
              {tools.length === 0 && !toolsLoading ? (
                <p className="hint mcp-tool-picker-status">{t(labels, 'editor.mcp.noTools')}</p>
              ) : (
                <ul className="mcp-tool-picker-list">
                  {tools.map((toolName) => (
                    <li key={toolName}>
                      <label className="mcp-tool-option">
                        <input
                          type="checkbox"
                          checked={selectedTools.includes(toolName)}
                          onChange={() => toggleTool(toolName)}
                        />
                        <span>{toolName}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              </LoadingHost>
            </div>
          )}
        </div>
        {selectedTools.length > 0 && (
          <div className="mcp-tool-chips">
            {selectedTools.map((toolName) => (
              <span key={toolName} className="mcp-tool-chip">
                {toolName}
                <button
                  type="button"
                  className="mcp-tool-chip-remove"
                  aria-label={t(labels, 'mcp.removeTool', { name: toolName })}
                  onClick={() => toggleTool(toolName)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </FormField>
      {toolsHint && <p className="hint">{toolsHint}</p>}
    </div>
  );
}
