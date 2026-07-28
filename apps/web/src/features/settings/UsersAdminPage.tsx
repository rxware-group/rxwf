import { t, useLabels } from '../../i18n/labels.js';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext } from 'react-router-dom';
import {
  api,
  AwfClientError,
  type AdminUserSummary,
} from '../../api/client.js';
import { FormField } from '../../components/FormField.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { Modal } from '../../components/Modal.js';
import { ModalFooter } from '../../components/ModalFooter.js';
import { Toast } from '../../components/Toast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import type { SettingsOutletContext } from './settings-context.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

import type { LabelMap } from '../../i18n/labels.js';

function statusLabel(labels: LabelMap, status: AdminUserSummary['status']): string {
  if (status === 'active') return t(labels, 'users.status.active');
  if (status === 'disabled') return t(labels, 'users.status.disabled');
  return t(labels, 'users.status.pending');
}

function joinMethodLabel(labels: LabelMap, joinMethod: AdminUserSummary['joinMethod']): string {
  if (joinMethod === 'invite') return t(labels, 'users.joinMethod.invite');
  if (joinMethod === 'direct') return t(labels, 'users.joinMethod.direct');
  return '—';
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  return date.toLocaleString();
}

function generateRandomPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function isValidEmail(email: string): boolean {
  return email.includes('@') && email.includes('.');
}

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  onError: (message: string, code?: string, traceId?: string) => void;
}

function InviteUserModal({ open, onClose, onSuccess, onError }: InviteUserModalProps) {
  const labels = useLabels();

  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setIsAdmin(false);
    setFieldError(null);
    setSubmitting(false);
  }, [open]);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setFieldError(t(labels, 'auto.t_732eaa6e'));
      return;
    }

    setSubmitting(true);
    setFieldError(null);
    try {
      await api.adminUsers.invite({ email: trimmed, isAdmin });
      await onSuccess();
      onClose();
    } catch (e) {
      if (e instanceof AwfClientError) {
        setFieldError(e.message);
        onError(e.message, e.code, e.traceId);
      } else {
        const message = e instanceof Error ? e.message : t(labels, 'auto.t_61ee3ae8');
        setFieldError(message);
        onError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t(labels, 'auto.t_033c969b')}
      onClose={onClose}
      closeOnBackdrop={!submitting}
      closeDisabled={submitting}
      footer={
        <ModalFooter
          actions={[
            {
              key: 'invite',
              label: t(labels, 'auto.t_ac9575dd'),
              variant: 'primary',
              disabled: submitting,
              onClick: () => void submit(),
            },
            {
              key: 'cancel',
              label: t(labels, 'common.cancel'),
              variant: 'secondary',
              disabled: submitting,
              onClick: onClose,
            },
          ]}
        />
      }
    >
      <LoadingHost loading={submitting} label={t(labels, 'auto.t_c1b89448')}>
      <p className="hint">{t(labels, 'users.inviteHint')}</p>
      <FormField label={t(labels, 'auto.t_f1f23107')}>
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError(null);
          }}
        />
      </FormField>
      {fieldError && <p className="form-error">{fieldError}</p>}
      <FormField label={t(labels, 'auto.Admin_a5f37e0b')} variant="inline">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
      </FormField>
      </LoadingHost>
    </Modal>
  );
}

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { email: string; temporaryPassword?: string }) => void;
  onError: (message: string, code?: string, traceId?: string) => void;
}

function CreateUserModal({ open, onClose, onCreated, onError }: CreateUserModalProps) {
  const labels = useLabels();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setPassword('');
    setIsAdmin(false);
    setMustChangePassword(true);
    setFieldError(null);
    setSubmitting(false);
  }, [open]);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setFieldError(t(labels, 'auto.t_732eaa6e'));
      return;
    }
    if (password.length < 8) {
      setFieldError(t(labels, 'auto.8_0346b9a2'));
      return;
    }

    setSubmitting(true);
    setFieldError(null);
    try {
      const res = await api.adminUsers.create({
        email: trimmed,
        password,
        isAdmin,
        mustChangePassword,
      });
      onCreated({ email: res.user.email, temporaryPassword: res.temporaryPassword ?? password });
      onClose();
    } catch (e) {
      if (e instanceof AwfClientError) {
        setFieldError(e.message);
        onError(e.message, e.code, e.traceId);
      } else {
        const message = e instanceof Error ? e.message : t(labels, 'auto.t_deb39901');
        setFieldError(message);
        onError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t(labels, 'auto.t_ede5f00d')}
      onClose={onClose}
      closeOnBackdrop={!submitting}
      closeDisabled={submitting}
      footer={
        <ModalFooter
          actions={[
            {
              key: 'create',
              label: t(labels, 'common.create'),
              variant: 'primary',
              disabled: submitting,
              onClick: () => void submit(),
            },
            {
              key: 'cancel',
              label: t(labels, 'common.cancel'),
              variant: 'secondary',
              disabled: submitting,
              onClick: onClose,
            },
          ]}
        />
      }
    >
      <LoadingHost loading={submitting} label={t(labels, 'auto.t_1680b04b')}>
      <FormField label={t(labels, 'auto.t_f1f23107')}>
        <input
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldError(null);
          }}
        />
      </FormField>
      <FormField
        label={t(labels, 'auto.t_bb128547')}
        labelExtra={
          <button
            type="button"
            className="btn-link"
            onClick={() => setPassword(generateRandomPassword())}
          >{t(labels, 'users.generatePassword')}</button>
        }
      >
        <input
          type="text"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldError(null);
          }}
        />
      </FormField>
      {fieldError && <p className="form-error">{fieldError}</p>}
      <FormField label={t(labels, 'auto.Admin_a5f37e0b')} variant="inline">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
      </FormField>
      <FormField label={t(labels, 'auto.t_f9dbe2c1')} variant="inline">
        <input
          type="checkbox"
          checked={mustChangePassword}
          onChange={(e) => setMustChangePassword(e.target.checked)}
        />
      </FormField>
      </LoadingHost>
    </Modal>
  );
}

interface UserRowMenuProps {
  user: AdminUserSummary;
  isSelf: boolean;
  onAction: (action: UserRowAction) => void;
}

type UserRowAction =
  | 'setAdmin'
  | 'revokeAdmin'
  | 'resetPassword'
  | 'resendInvite'
  | 'revokeInvite'
  | 'disable'
  | 'enable'
  | 'delete';

function UserRowMenu({ user, isSelf, onAction }: UserRowMenuProps) {
  const labels = useLabels();

  const items: Array<{ key: UserRowAction; label: string; danger?: boolean }> = [];

  if (!isSelf) {
    items.push({
      key: user.isAdmin ? 'revokeAdmin' : 'setAdmin',
      label: user.isAdmin ? t(labels, 'auto.Admin_a47405d6') : t(labels, 'auto.Admin_a5f37e0b'),
    });
  }

  if (user.status === 'active' && user.joinMethod === 'direct') {
    items.push({ key: 'resetPassword', label: t(labels, 'auto.t_7e422146') });
  }

  if (user.status === 'pending_invite') {
    items.push({ key: 'resendInvite', label: t(labels, 'auto.t_b04a72f5') });
    items.push({ key: 'revokeInvite', label: t(labels, 'auto.t_b58d02f8'), danger: true });
  }

  if (user.status === 'active' && !isSelf) {
    items.push({ key: 'disable', label: t(labels, 'auto.t_d989e551'), danger: true });
  }

  if (user.status === 'disabled') {
    items.push({ key: 'enable', label: t(labels, 'auto.t_d4e9ca3d') });
    items.push({ key: 'delete', label: t(labels, 'common.delete'), danger: true });
  }

  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 0;
    const menuWidth = menu?.offsetWidth ?? 120;
    const gap = 4;
    const viewportPad = 8;

    let top = rect.bottom + gap;
    if (menuHeight > 0 && top + menuHeight > window.innerHeight - viewportPad) {
      top = Math.max(viewportPad, rect.top - menuHeight - gap);
    }

    const left = Math.min(
      window.innerWidth - menuWidth - viewportPad,
      Math.max(viewportPad, rect.right - menuWidth),
    );

    setMenuStyle({ top, left, minWidth: 120 });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition, items.length]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (items.length === 0) {
    return <span className="row-actions-placeholder">—</span>;
  }

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="workflow-node-menu workflow-node-menu--portal"
            role="menu"
            style={menuStyle}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={item.danger ? 'danger' : undefined}
                onClick={() => {
                  setOpen(false);
                  onAction(item.key);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="workflow-node-more-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`row-more-btn ${open ? 'is-active' : ''}`}
        aria-label={t(labels, 'auto.t_b196954f')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

export function UsersAdminPage() {
  const labels = useLabels();
  const inviteDisabledTitle = t(labels, 'auto.SMTP_SMTP_97b59982');

  const { user: currentUser } = useOutletContext<SettingsOutletContext>();
  const { confirm, dialog } = useConfirm();

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);
  const [revealedCredentials, setRevealedCredentials] = useState<{
    email: string;
    password: string;
    label: string;
  } | null>(null);

  const showError = useCallback((e: unknown) => {
    if (e instanceof AwfClientError) {
      setToast({ message: e.message, code: e.code, traceId: e.traceId });
      return;
    }
    setToast({ message: e instanceof Error ? e.message : t(labels, 'common.operationFailed') });
  }, []);

  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    const isRefresh = hasLoadedRef.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const list = await api.adminUsers.list();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
      if (!isRefresh) setUsers([]);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.auth.passwordResetStatus().then((status) => {
      setPasswordResetEnabled(status.enabled);
    });
  }, []);

  const handleRowAction = async (target: AdminUserSummary, action: UserRowAction) => {
    const isSelf = target.email.toLowerCase() === currentUser.email.toLowerCase();

    try {
      if (action === 'setAdmin') {
        const ok = await confirm({
          title: t(labels, 'auto.Admin_a5f37e0b'),
          message: t(labels, 'confirm.setAdmin', { email: target.email }),
          confirmLabel: t(labels, 'auto.t_f526c899'),
        });
        if (!ok) return;
        await api.adminUsers.patch(target.id, { isAdmin: true });
      } else if (action === 'revokeAdmin') {
        const ok = await confirm({
          title: t(labels, 'auto.Admin_a47405d6'),
          message: t(labels, 'confirm.revokeAdmin', { email: target.email }),
          confirmLabel: t(labels, 'auto.t_9fcefd8d'),
          danger: true,
        });
        if (!ok) return;
        await api.adminUsers.patch(target.id, { isAdmin: false });
      } else if (action === 'resetPassword') {
        const ok = await confirm({
          title: t(labels, 'auto.t_7e422146'),
          message: t(labels, 'confirm.resetPassword', { email: target.email }),
          confirmLabel: t(labels, 'auto.t_3d813453'),
        });
        if (!ok) return;
        const res = await api.adminUsers.patch(target.id, { resetPassword: true });
        if (res.temporaryPassword) {
          setRevealedCredentials({
            email: target.email,
            password: res.temporaryPassword,
            label: t(labels, 'auto.t_17ba0d54'),
          });
        }
      } else if (action === 'resendInvite') {
        await api.adminUsers.resendInvite(target.id);
        setToast({ message: t(labels, 'toast.resentInvite', { email: target.email }) });
      } else if (action === 'revokeInvite') {
        const ok = await confirm({
          title: t(labels, 'auto.t_b58d02f8'),
          message: t(labels, 'confirm.revokeInvite', { email: target.email }),
          confirmLabel: t(labels, 'auto.t_9fcefd8d'),
          danger: true,
        });
        if (!ok) return;
        await api.adminUsers.revokeInvite(target.id);
      } else if (action === 'disable') {
        if (isSelf) return;
        const ok = await confirm({
          title: t(labels, 'auto.t_3f2f67ac'),
          message: t(labels, 'confirm.disableUser', { email: target.email }),
          confirmLabel: t(labels, 'auto.t_d989e551'),
          danger: true,
        });
        if (!ok) return;
        await api.adminUsers.patch(target.id, { status: 'disabled' });
      } else if (action === 'enable') {
        await api.adminUsers.patch(target.id, { status: 'active' });
      } else if (action === 'delete') {
        const ok = await confirm({
          title: t(labels, 'auto.t_bcfca951'),
          message: t(labels, 'confirm.deleteUser', { email: target.email }),
          confirmLabel: t(labels, 'common.delete'),
          danger: true,
        });
        if (!ok) return;
        await api.adminUsers.remove(target.id);
      }

      await load();
    } catch (e) {
      showError(e);
    }
  };

  const handleCreated = (result: { email: string; temporaryPassword?: string }) => {
    if (result.temporaryPassword) {
      setRevealedCredentials({
        email: result.email,
        password: result.temporaryPassword,
        label: t(labels, 'auto.t_a983606a'),
      });
    }
    void load();
  };

  const copyCredentials = () => {
    if (!revealedCredentials) return;
    const text = t(labels, 'users.credentialsCopy', {
      email: revealedCredentials.email,
      password: revealedCredentials.password,
    });
    void navigator.clipboard.writeText(text);
  };

  return (
    <SettingsPageShell titleKey="settings.nav.users">
      {dialog}

      {toast && (
        <Toast
          message={toast.message}
          code={toast.code}
          traceId={toast.traceId}
          onDismiss={() => setToast(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      <SettingsSection>
        {revealedCredentials && (
          <div className="token-reveal panel">
            <p>
              <strong>{revealedCredentials.label}</strong>
            </p>
            <p className="hint">{t(labels, 'common.emailColon', { email: revealedCredentials.email })}</p>
            <code className="token-block">{revealedCredentials.password}</code>
            <button
              type="button"
              className="btn-secondary"
              onClick={copyCredentials}
            >{t(labels, 'users.copyCredentials')}</button>
          </div>
        )}

        <header className="settings-page-toolbar">
          <button
            type="button"
            className="btn-primary"
            disabled={!passwordResetEnabled}
            title={!passwordResetEnabled ? inviteDisabledTitle : undefined}
            onClick={() => setInviteOpen(true)}
          >{t(labels, 'users.inviteUser')}</button>
          <button type="button" className="btn-secondary" onClick={() => setCreateOpen(true)}>{t(labels, 'users.joinMethod.direct')}</button>
          <button type="button" onClick={() => void load()} disabled={loading || refreshing}>
            {refreshing && (
              <LoadingSpinner size="sm" label={t(labels, 'common.refreshing')} />
            )}{' '}
            {t(labels, 'common.refresh')}
          </button>
        </header>

        <LoadingHost
          loading={loading || refreshing}
          label={loading ? t(labels, 'auto.t_300ee3de') : t(labels, 'common.refreshing')}
        >
        <table className={`data-table${refreshing ? ' data-table--busy' : ''}`}>
          <thead>
            <tr>
              <th>{t(labels, 'common.email')}</th>
              <th>{t(labels, 'users.col.systemRole')}</th>
              <th>{t(labels, 'auto.t_62e951a6')}</th>
              <th>{t(labels, 'users.col.joinMethod')}</th>
              <th>{t(labels, 'users.col.lastLogin')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="hint">{t(labels, 'users.empty')}</td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.email.toLowerCase() === currentUser.email.toLowerCase();
                return (
                  <tr key={u.id}>
                    <td>
                      {u.email}
                      {isSelf && <span className="role-tag">{t(labels, 'users.currentUser')}</span>}
                    </td>
                    <td>{u.isAdmin ? <span className="role-tag">Admin</span> : '—'}</td>
                    <td>{statusLabel(labels, u.status)}</td>
                    <td>{joinMethodLabel(labels, u.joinMethod)}</td>
                    <td title={u.lastLoginAt ?? undefined}>{formatRelativeTime(u.lastLoginAt)}</td>
                    <td className="row-actions">
                      <UserRowMenu
                        user={u}
                        isSelf={isSelf}
                        onAction={(action) => void handleRowAction(u, action)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </LoadingHost>

        <p className="hint settings-panel-hint">
          {t(labels, 'users.emptyHintText')}
          {!passwordResetEnabled && (
            <>
              {' '}
              {t(labels, 'users.smtpHintPrefix')}{' '}
              <Link to="/settings/env">{t(labels, 'settings.nav.env')}</Link>
              {t(labels, 'users.smtpHintSuffix')}
            </>
          )}
        </p>
      </SettingsSection>

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={load}
        onError={(message, code, traceId) => setToast({ message, code, traceId })}
      />
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        onError={(message, code, traceId) => setToast({ message, code, traceId })}
      />
    </SettingsPageShell>
  );
}
