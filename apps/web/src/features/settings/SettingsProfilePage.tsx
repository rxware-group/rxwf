import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { t, useLabels } from '../../i18n/labels.js';
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';
import type { SettingsOutletContext } from './settings-context.js';

const MAX_AVATAR_BYTES = 256 * 1024;

function displayName(user: { nickname?: string; email: string }): string {
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const local = user.email.split('@')[0] ?? user.email;
  return local.replace(/[._]/g, ' ').trim() || user.email;
}

function avatarLetter(user: { nickname?: string; email: string }): string {
  const nick = user.nickname?.trim();
  if (nick) {
    const ch = nick[0];
    return ch ? ch.toUpperCase() : '?';
  }
  const ch = user.email.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function SettingsProfilePage() {
  const labels = useLabels();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const { user, onUserUpdate } = useOutletContext<SettingsOutletContext>();

  const isAdmin = user.role === 'admin';
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [editingNickname, setEditingNickname] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(user.nickname ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user.nickname, user.avatarUrl]);

  const saveProfile = useCallback(
    async (patch?: Partial<{ nickname: string; avatarUrl: string | null }>) => {
      setSaving(true);
      setMessage(null);
      setError(null);
      try {
        const nextNickname = patch?.nickname ?? nickname;
        const nextAvatarUrl =
          patch?.avatarUrl !== undefined ? patch.avatarUrl : avatarUrl || null;
        const updated = await api.profile.patch({
          nickname: nextNickname,
          avatarUrl: nextAvatarUrl,
        });
        onUserUpdate(updated);
        setNickname(updated.nickname ?? '');
        setAvatarUrl(updated.avatarUrl ?? '');
        setMessage(t(labels, 'common.saved'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [avatarUrl, labels, nickname, onUserUpdate],
  );

  const commitNicknameEdit = useCallback(async () => {
    setEditingNickname(false);
    const trimmed = nickname.trim();
    if (trimmed === (user.nickname ?? '').trim()) return;
    await saveProfile({ nickname: trimmed });
  }, [nickname, saveProfile, user.nickname]);

  useEffect(() => {
    if (!editingNickname) return;
    nicknameInputRef.current?.focus();
    nicknameInputRef.current?.select();
  }, [editingNickname]);

  const onAvatarFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t(labels, 'settings.profile.avatarInvalid'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t(labels, 'settings.profile.avatarTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const url = reader.result;
        setAvatarUrl(url);
        setError(null);
        void saveProfile({ avatarUrl: url });
      }
    };
    reader.readAsDataURL(file);
  };

  const previewUser = { nickname, email: user.email };

  return (
    <SettingsPageShell>
      <SettingsSection>
        <LoadingHost loading={saving} label={t(labels, 'common.saving')}>
        <div className="settings-profile-identity">
          <div className="settings-profile-avatar-block">
            <button
              type="button"
              className="settings-profile-avatar-trigger"
              aria-label={t(labels, 'settings.profile.avatarUpload')}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="settings-profile-avatar settings-profile-avatar--img"
                />
              ) : (
                <span className="settings-profile-avatar" aria-hidden>
                  {avatarLetter(previewUser)}
                </span>
              )}
            </button>
            {avatarUrl ? (
              <button
                type="button"
                className="btn-link"
                onClick={() => void saveProfile({ avatarUrl: null })}
              >
                {t(labels, 'settings.profile.avatarRemove')}
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onAvatarFile(e.target.files?.[0])}
            />
          </div>

          <div className="settings-profile-summary">
            <div className="settings-profile-name-row">
              {editingNickname ? (
                <input
                  ref={nicknameInputRef}
                  type="text"
                  className="settings-profile-nickname-input"
                  value={nickname}
                  maxLength={64}
                  placeholder={displayName({ email: user.email })}
                  onChange={(e) => setNickname(e.target.value)}
                  onBlur={() => void commitNicknameEdit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitNicknameEdit();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setNickname(user.nickname ?? '');
                      setEditingNickname(false);
                    }
                  }}
                />
              ) : (
                <>
                  <span className="settings-profile-display-name">
                    {displayName(previewUser)}
                  </span>
                  <button
                    type="button"
                    className="settings-profile-edit-btn"
                    aria-label={t(labels, 'settings.profile.nickname')}
                    onClick={() => setEditingNickname(true)}
                  >
                    <PencilIcon />
                  </button>
                  {isAdmin && <span className="role-tag">Admin</span>}
                </>
              )}
            </div>
            <p className="settings-profile-email-line">{user.email}</p>
            <Link to="/change-password" className="btn-secondary settings-profile-password-btn">
              {t(labels, 'settings.profile.changePassword')}
            </Link>
            {error ? <p className="error-text">{error}</p> : null}
            {message ? <p className="success-text">{message}</p> : null}
          </div>
        </div>
        </LoadingHost>
      </SettingsSection>
    </SettingsPageShell>
  );
}
