import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  api,
  type ChatBotDraftConfig,
  type ChatBotSummary,
  type KnowledgeBaseSummary,
} from '../../api/client.js';
import type { AppOutletContext } from '../../layout/app-outlet-context.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { FormField } from '../../components/FormField.js';
import { t } from './chat-labels.js';
import { BotConfigForm } from './components/BotConfigForm.js';

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

export function ChatBotEditorPage() {
  const { labels } = useOutletContext<AppOutletContext>();
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<ChatBotSummary | null>(null);
  const [draft, setDraft] = useState<ChatBotDraftConfig | null>(null);
  const [kbs, setKbs] = useState<KnowledgeBaseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [nlExplanation, setNlExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (!botId) return;
    void api.knowledgeBases.list().then(setKbs).catch(() => setKbs([]));
    void api.chatBots
      .get(botId)
      .then(({ bot: b, draft: d }) => {
        setBot(b);
        setDraft(d);
      })
      .catch((e) => setError(String(e)));
  }, [botId]);

  async function generateFromPrompt() {
    if (!botId || !nlPrompt.trim()) return;
    setNlBusy(true);
    setError(null);
    setNlExplanation(null);
    try {
      const res = await api.chatBots.generateConfig(botId, nlPrompt.trim());
      setDraft(res.config);
      setNlExplanation(res.explanation);
      setNlPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNlBusy(false);
    }
  }

  async function save() {
    if (!botId || !draft) return;
    setError(null);
    const res = await api.chatBots.update(botId, { config: draft });
    setBot(res.bot);
    setDraft(res.draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!botId) return null;

  return (
    <main className="main page">
      <header className="page-header">
        <h2 className="page-title-with-back rxwf-type-page-title">
          <Link
            to="/chat/bots"
            className="page-back-link"
            aria-label={t(labels, 'chat.bot.editor.back')}
          >
            <BackArrowIcon />
          </Link>
          {bot?.name ?? t(labels, 'chat.bot.editor.title')}
        </h2>
        <p className="muted">
          slug: <code>{bot?.slug}</code> · {bot?.status}
        </p>
      </header>

      {error && <p className="form-error">{error}</p>}

      {draft && (
        <>
          <section className="card page-section-card">
            <LoadingHost loading={nlBusy} label={t(labels, 'chat.bot.editor.nlBusy')}>
              <FormField label={t(labels, 'chat.bot.editor.nlTitle')}>
                <>
                  <p className="rxwf-type-block-hint">{t(labels, 'chat.bot.editor.nlDesc')}</p>
                  <textarea
                    rows={3}
                    value={nlPrompt}
                    placeholder={t(labels, 'chat.bot.editor.nlPlaceholder')}
                    onChange={(e) => setNlPrompt(e.target.value)}
                  />
                </>
              </FormField>
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={nlBusy || !nlPrompt.trim()}
                  onClick={() => void generateFromPrompt()}
                >
                  {t(labels, 'chat.bot.editor.nlGenerate')}
                </button>
              </div>
              {nlExplanation && <p className="rxwf-type-block-hint">{nlExplanation}</p>}
            </LoadingHost>
          </section>

          <section className="card page-section-card">
            <BotConfigForm draft={draft} onChange={setDraft} labels={labels} />
            <p className="rxwf-type-block-hint">{t(labels, 'chat.bot.editor.kbHint')}</p>
            <div className="rxwf-inline-group">
              {kbs.map((kb) => {
                const on = draft.knowledgeBaseIds.includes(kb.id);
                return (
                  <button
                    key={kb.id}
                    type="button"
                    className={on ? 'btn-primary' : 'btn-secondary'}
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              knowledgeBaseIds: on
                                ? d.knowledgeBaseIds.filter((id) => id !== kb.id)
                                : [...d.knowledgeBaseIds, kb.id],
                            }
                          : d,
                      )
                    }
                  >
                    {kb.name}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="rxwf-actions-row">
            <button type="button" className="btn-primary" onClick={() => void save()}>
              {t(labels, 'chat.bot.editor.save')}
            </button>
            {saved && <span className="muted">{t(labels, 'chat.bot.editor.saved')}</span>}
            <Link to={`/chat/bots/${botId}/publish`} className="btn-secondary">
              {t(labels, 'chat.bot.editor.publishLink')}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
