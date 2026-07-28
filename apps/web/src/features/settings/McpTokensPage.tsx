import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useState } from 'react';
import { api, type McpTokenSummary } from '../../api/client.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { FormField } from '../../components/FormField.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

export function McpTokensPage({
 publicUrl }: { publicUrl: string }) {
  const labels = useLabels();

  const { confirm, dialog } = useConfirm();
  const [tokens, setTokens] = useState<McpTokenSummary[]>([]);
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [mcpJson, setMcpJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setTokens(await api.mcpTokens.list());
  }, []);

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [reload]);

  const create = async () => {
    setError(null);
    setCreatedToken(null);
    setMcpJson(null);
    try {
      const res = await api.mcpTokens.create(name.trim() || 'default');
      setCreatedToken(res.token);
      setMcpJson(JSON.stringify(res.mcpJson, null, 2));
      setName('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const revoke = async (id: string, label: string) => {
    const ok = await confirm({
      title: t(labels, 'auto.MCP_Token_9fed3064'),
      message: t(labels, 'confirm.revokeMcpToken', { label }),
      confirmLabel: t(labels, 'auto.t_8e3a7bd9'),
      danger: true,
    });
    if (!ok) return;
    await api.mcpTokens.revoke(id);
    await reload();
  };

  const copyMcpJson = () => {
    if (mcpJson) void navigator.clipboard.writeText(mcpJson);
  };

  return (
    <SettingsPageShell
      lead={
        <p className="hint settings-page-lead">
          {t(labels, 'settings.mcpTokens.lead')}
          <code>{publicUrl}/mcp</code>
          {t(labels, 'common.period')}
        </p>
      }
    >
      {dialog}

      <SettingsSection title={t(labels, 'settings.mcpTokens.create')}>
        <FormField label={t(labels, 'auto.t_1be7ae4f')}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-ide" />
        </FormField>
        <button type="button" className="btn-primary" onClick={() => void create()}>
          {t(labels, 'settings.mcpTokens.create')}
        </button>

        {createdToken && (
          <div className="token-reveal panel">
            <p>
              <strong>{t(labels, 'settings.mcpTokens.tokenOnce')}</strong>
            </p>
            <code className="token-block">{createdToken}</code>
            {mcpJson && (
              <>
                <p className="rxwf-mt-block">
                  <strong>{t(labels, 'settings.mcpTokens.mcpJsonSnippet')}</strong>
                </p>
                <pre className="debug-data-box">{mcpJson}</pre>
                <button type="button" className="btn-secondary" onClick={copyMcpJson}>
                  {t(labels, 'settings.mcpTokens.copyMcpJson')}
                </button>
              </>
            )}
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </SettingsSection>

      <SettingsSection title={t(labels, 'settings.mcpTokens.issued')}>
        {tokens.length === 0 ? (
          <p className="hint">{t(labels, 'settings.mcpTokens.empty')}</p>
        ) : (
          <ul className="list-plain">
            {tokens.map((token) => (
              <li key={token.id} className="list-row">
                <span>{token.name}</span>
                <span className="meta">{new Date(token.createdAt).toLocaleString()}</span>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void revoke(token.id, token.name)}
                >
                  {t(labels, 'settings.mcpTokens.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPageShell>
  );
}

