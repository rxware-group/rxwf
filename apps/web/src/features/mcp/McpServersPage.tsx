import { t, useLabels, type LabelMap } from '../../i18n/labels.js';
import { useCallback, useEffect, useState } from 'react';
import { api, type McpDockerConfig, type McpServer } from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { Select } from '../../components/Select.js';
import { SettingsPageShell, SettingsSection } from '../settings/SettingsPageShell.js';

type Transport = McpServer['transport'];
type ConnectionStatus = 'unknown' | 'testing' | 'connected' | 'failed';

function statusLabel(labels: LabelMap, status: ConnectionStatus): string {
  if (status === 'unknown') return t(labels, 'auto.t_7b5b7a49');
  if (status === 'testing') return t(labels, 'auto.t_49562bf1');
  if (status === 'connected') return t(labels, 'auto.t_65fe35c4');
  return t(labels, 'auto.t_2c056f18');
}

const emptyForm = {
  name: '',
  transport: 'npx' as Transport,
  command: '',
  args: '',
  url: '',
  dockerCommand: '',
  dockerImage: '',
  dockerArgs: '',
  dockerVolumes: '',
  dockerEnv: '',
  dockerNetwork: '',
};

function parseEnvLines(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

function buildDockerPayload(form: typeof emptyForm): McpDockerConfig | undefined {
  if (form.transport !== 'docker') return undefined;
  const image = form.dockerImage.trim();
  const env = parseEnvLines(form.dockerEnv);
  const volumes = form.dockerVolumes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const args = form.dockerArgs.split(/\s+/).filter(Boolean);
  const network = form.dockerNetwork.trim();
  const docker: McpDockerConfig = {
    ...(image ? { image } : {}),
    ...(args.length ? { args } : {}),
    ...(volumes.length ? { volumes } : {}),
    ...(Object.keys(env).length ? { env } : {}),
    ...(network && image ? { network } : {}),
  };
  return Object.keys(docker).length > 0 ? docker : undefined;
}

type DockerCreateBody =
  | { error: string }
  | {
      name: string;
      transport: 'docker';
      command?: string;
      args?: string[];
      docker?: McpDockerConfig;
    };

function buildDockerCreateBody(labels: LabelMap, form: typeof emptyForm): DockerCreateBody {
  const image = form.dockerImage.trim();
  const args = form.dockerArgs.split(/\s+/).filter(Boolean);
  const command = form.dockerCommand.trim();
  const docker = buildDockerPayload(form);
  if (!image && (!command || args.length === 0)) {
    return { error: t(labels, 'auto.docker_run_dbc71ff7') };
  }
  return {
    name: form.name,
    transport: 'docker',
    command: !image ? command : undefined,
    args: !image && args.length > 0 ? args : undefined,
    docker,
  };
}

export function McpServersPage() {
  const labels = useLabels();

  const [servers, setServers] = useState<McpServer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, ConnectionStatus>>({});

  const reload = useCallback(async () => {
    setServers(await api.mcpServers.list());
  }, []);

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  const create = async () => {
    setError(null);
    try {
      if (form.transport === 'npx' && (!form.command.trim() || !form.args.trim())) {
        setError(t(labels, 'auto.npx_137713da'));
        return;
      }
      if (form.transport === 'http' && !form.url.trim()) {
        setError(t(labels, 'auto.HTTP_URL_950a2239'));
        return;
      }
      if (form.transport === 'docker') {
        const body = buildDockerCreateBody(labels, form);
        if ('error' in body) {
          setError(body.error);
          return;
        }
        await api.mcpServers.create({
          name: body.name,
          transport: body.transport,
          command: body.command,
          args: body.args,
          docker: body.docker,
        });
      } else {
        await api.mcpServers.create({
          name: form.name,
          transport: form.transport,
          command: form.command.trim(),
          args: form.args.split(/\s+/).filter(Boolean),
        });
      }
      setForm(emptyForm);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: string) => {
    await api.mcpServers.remove(id);
    setStatusById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await reload();
  };

  const test = async (id: string) => {
    setStatusById((prev) => ({ ...prev, [id]: 'testing' }));
    setError(null);
    try {
      await api.mcpServers.test(id);
      setStatusById((prev) => ({ ...prev, [id]: 'connected' }));
    } catch (e) {
      setStatusById((prev) => ({ ...prev, [id]: 'failed' }));
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const connectionStatus = (id: string): ConnectionStatus => statusById[id] ?? 'unknown';

  const describeServer = (s: McpServer) => {
    if (s.transport === 'docker') {
      if (s.docker?.image) {
        const parts = [s.docker.image];
        if (s.docker.args?.length) parts.push(s.docker.args.join(' '));
        if (s.docker.volumes?.length) parts.push(`vol: ${s.docker.volumes.join(', ')}`);
        return parts.join(' · ');
      }
      const cmd = s.command ?? 'docker';
      const args = s.args ?? s.docker?.args ?? [];
      return `${cmd} ${args.join(' ')}`.trim();
    }
    if (s.transport === 'npx' && s.command) {
      return `${s.command} ${(s.args ?? []).join(' ')}`;
    }
    if (s.url) return s.url;
    return '';
  };

  return (
    <SettingsPageShell
      lead={
        <p className="hint settings-page-lead">
          {t(labels, 'mcp.leadPrefix')}{' '}
          <code>{t(labels, 'mcp.leadDockerRun')}</code>{' '}
          {t(labels, 'mcp.leadMid')}{' '}
          <code>{t(labels, 'mcp.leadCursorJson')}</code>
          {t(labels, 'mcp.leadSuffix')}{' '}
          <code>docker run -i</code>
          {t(labels, 'common.period')}
        </p>
      }
    >
      <SettingsSection title={t(labels, 'common.addNew')} className="mcp-server-form">
        <FormField label={t(labels, 'auto.t_1be7ae4f')}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label={t(labels, 'auto.t_14b6b3a2')}>
          <Select
            value={form.transport}
            onChange={(transport) =>
              setForm({ ...form, transport: transport as Transport })
            }
            options={[
              { value: 'npx', label: 'npx (stdio)' },
              { value: 'docker', label: 'docker (stdio)' },
              { value: 'http', label: 'http' },
            ]}
          />
        </FormField>
        {form.transport === 'npx' && (
          <>
            <FormField label={t(labels, 'auto.t_b114b915')}>
              <input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="npx"
              />
            </FormField>
            <FormField label={t(labels, 'auto.t_58d322d3')}>
              <input
                value={form.args}
                onChange={(e) => setForm({ ...form, args: e.target.value })}
                placeholder="-y @modelcontextprotocol/server-filesystem ."
              />
            </FormField>
          </>
        )}
        {form.transport === 'docker' && (
          <>
            <FormField label={t(labels, 'auto.t_b114b915')}>
              <input
                value={form.dockerCommand}
                onChange={(e) => setForm({ ...form, dockerCommand: e.target.value })}
                placeholder="docker"
              />
            </FormField>
            <FormField label={t(labels, 'auto.t_58d322d3')}>
              <input
                value={form.dockerArgs}
                onChange={(e) => setForm({ ...form, dockerArgs: e.target.value })}
                placeholder="mcp gateway run --profile default"
              />
            </FormField>
            <FormField label={t(labels, 'auto.docker_run_621504d3')}>
              <input
                value={form.dockerImage}
                onChange={(e) => setForm({ ...form, dockerImage: e.target.value })}
                placeholder={t(labels, 'auto.Docker_Gateway_CLI_dde7246b')}
              />
            </FormField>
            {form.dockerImage.trim() && (
              <FormField label={t(labels, 'auto.host_container_ro_ffec0101')}>
                <textarea
                  rows={3}
                  value={form.dockerVolumes}
                  onChange={(e) => setForm({ ...form, dockerVolumes: e.target.value })}
                  placeholder="/data:/data:ro"
                />
              </FormField>
            )}
            <FormField label={t(labels, 'auto.KEY_value_eb841eff')}>
              <textarea
                rows={3}
                value={form.dockerEnv}
                onChange={(e) => setForm({ ...form, dockerEnv: e.target.value })}
                placeholder="TOKEN=secret"
              />
            </FormField>
            {form.dockerImage.trim() && (
              <FormField label={t(labels, 'auto.docker_run_62462394')}>
                <Select
                  value={form.dockerNetwork}
                  onChange={(dockerNetwork) => setForm({ ...form, dockerNetwork })}
                  options={[
                    { value: '', label: t(labels, 'common.default') },
                    { value: 'bridge', label: 'bridge' },
                    { value: 'host', label: 'host' },
                    { value: 'none', label: 'none' },
                  ]}
                />
              </FormField>
            )}
          </>
        )}
        {form.transport === 'http' && (
          <FormField label="URL">
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </FormField>
        )}
        <button type="button" className="btn-primary" onClick={() => void create()}>{t(labels, 'auto.t_fadf24db')}</button>
      </SettingsSection>

      {error && <p className="error">{error}</p>}

      <SettingsSection title={t(labels, 'common.registered')}>
        {servers.length === 0 ? (
          <p className="hint">{t(labels, 'mcp.empty')}</p>
        ) : (
          <ul className="mcp-server-list">
            {servers.map((s) => {
              const status = connectionStatus(s.id);
              const detail = describeServer(s);
              return (
                <li key={s.id} className="mcp-server-row">
                  <div className="mcp-server-row__main">
                    <strong>{s.name}</strong>
                    <span className="meta">
                      <span className="mcp-transport-tag">{s.transport}</span>
                      {detail ? ` · ${detail}` : ''}
                    </span>
                  </div>
                  <div className="mcp-server-row__tail">
                    <span className={`mcp-status mcp-status--${status}`} title={statusLabel(labels, status)}>
                      <span className="mcp-status-dot" aria-hidden />
                      {statusLabel(labels, status)}
                    </span>
                    <div className="mcp-server-row__actions">
                      <button
                        type="button"
                        className="btn-sm btn-secondary"
                        disabled={status === 'testing'}
                        onClick={() => void test(s.id)}
                      >{t(labels, 'mcp.testConnection')}</button>
                      <button
                        type="button"
                        className="btn-sm btn-danger"
                        disabled={status === 'testing'}
                        onClick={() => void remove(s.id)}
                      >{t(labels, 'auto.t_3755f56f')}</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>
    </SettingsPageShell>
  );
}
