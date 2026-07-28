import { t, useLabels } from '../../i18n/labels.js';
import { Fragment, useMemo } from 'react';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

type MatrixRow = {
  labelKey: string;
  admin: boolean;
  owner: boolean;
  editor: boolean;
  viewer: boolean;
};

const RBAC_MATRIX: MatrixRow[] = [
  { labelKey: 'auto.t_e976eab5', admin: true, owner: false, editor: false, viewer: false },
  { labelKey: 'settings.nav.users', admin: true, owner: false, editor: false, viewer: false },
  { labelKey: 'auto.CRUD_08254590', admin: true, owner: true, editor: true, viewer: false },
  { labelKey: 'auto.t_1ef8dea0', admin: true, owner: true, editor: true, viewer: false },
  { labelKey: 'auto.t_93f29308', admin: true, owner: true, editor: true, viewer: true },
  { labelKey: 'auto.t_27e9529d', admin: true, owner: true, editor: false, viewer: false },
  { labelKey: 'auto.MCP_Token_bad98a01', admin: true, owner: true, editor: false, viewer: false },
  { labelKey: 'auto.AI_Chat_1a96e3ba', admin: true, owner: true, editor: true, viewer: true },
  { labelKey: 'auto.t_1bf07768', admin: true, owner: true, editor: true, viewer: false },
  { labelKey: 'auto.t_6d5394a7', admin: true, owner: true, editor: true, viewer: false },
];

const ROLE_DESCRIPTIONS: { role: string; textKey: string }[] = [
  { role: 'Admin', textKey: 'auto.t_e9d2a6fd' },
  { role: 'Owner', textKey: 'auto.MCP_Token_1077cd3f' },
  { role: 'Editor', textKey: 'auto.t_c425fd29' },
  { role: 'Viewer', textKey: 'auto.t_6b6d81d0' },
];

function permCell(allowed: boolean) {
  return allowed ? '✓' : '—';
}

export function RolesReferencePage() {
  const labels = useLabels();

  const matrix = useMemo(
    () => RBAC_MATRIX.map((row) => ({ ...row, label: t(labels, row.labelKey) })),
    [labels],
  );
  const roleDescriptions = useMemo(
    () => ROLE_DESCRIPTIONS.map((row) => ({ ...row, text: t(labels, row.textKey) })),
    [labels],
  );

  return (
    <SettingsPageShell>
      <SettingsSection>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t(labels, 'settings.roles.col.permission')}</th>
              <th>Admin</th>
              <th>Owner</th>
              <th>Editor</th>
              <th>Viewer</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.labelKey}>
                <td>{row.label}</td>
                <td>{permCell(row.admin)}</td>
                <td>{permCell(row.owner)}</td>
                <td>{permCell(row.editor)}</td>
                <td>{permCell(row.viewer)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="settings-dl rxwf-mt-block">
          {roleDescriptions.map(({ role, text }) => (
            <Fragment key={role}>
              <dt>{role}</dt>
              <dd>{text}</dd>
            </Fragment>
          ))}
        </dl>
      </SettingsSection>
    </SettingsPageShell>
  );
}
