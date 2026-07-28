import { useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../../api/client.js';

import { useConfirm } from '../../hooks/useConfirm.js';

import { t, useLabels } from '../../i18n/labels.js';

import { AgentMemoryChatMessages } from './AgentMemoryChatMessages.js';

import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

function BackArrowIcon() {
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
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function AgentMemorySessionPage() {

  const labels = useLabels();

  const navigate = useNavigate();

  const { sessionId: sessionIdParam } = useParams<{ sessionId: string }>();

  const sessionId = sessionIdParam ? decodeURIComponent(sessionIdParam) : '';

  const [messageCount, setMessageCount] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const { confirm, dialog } = useConfirm();



  const removeSession = async () => {

    if (!sessionId) return;

    const ok = await confirm({

      title: t(labels, 'common.delete'),

      message: t(labels, 'agentMemory.deleteSessionConfirm', {

        sessionId,

        count: String(messageCount),

      }),

      requireTextMatch: sessionId,

      danger: true,

      confirmLabel: t(labels, 'common.delete'),

    });

    if (!ok) return;

    try {

      await api.agentMemory.deleteSession(sessionId);

      navigate('/settings/agent-memory');

    } catch (e) {

      setError(e instanceof Error ? e.message : String(e));

    }

  };



  if (!sessionId) {

    return (

      <SettingsPageShell titleKey="settings.nav.agentMemory">

        <p className="error">{t(labels, 'agentMemory.session.missingId')}</p>

      </SettingsPageShell>

    );

  }



  return (

    <SettingsPageShell
      titleKey="settings.nav.agentMemory"
      className="settings-page--agent-memory-session"
    >

      {dialog}

      {error ? <p className="error">{error}</p> : null}



      <SettingsSection
        className="agent-memory-session-section"
      >

        <div className="agent-memory-session-head">

          <p className="agent-memory-session-id-line">
            <Link
              to="/settings/agent-memory"
              className="agent-memory-session-back"
              aria-label={t(labels, 'agentMemory.session.backToList')}
            >
              <BackArrowIcon />
            </Link>
            {t(labels, 'agentMemory.list.sessionId')}:{' '}
            <code className="agent-memory-session-id">{sessionId}</code>
          </p>

          <button
            type="button"
            className="btn-danger btn-secondary--compact"
            onClick={() => void removeSession()}
          >
            {t(labels, 'agentMemory.session.clearSession')}
          </button>

        </div>



        <div className="agent-memory-session-messages">

          <AgentMemoryChatMessages

            sessionId={sessionId}

            onTotalChange={setMessageCount}

          />

        </div>

      </SettingsSection>

    </SettingsPageShell>

  );

}

