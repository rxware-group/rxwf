import { t, useLabels } from '../../i18n/labels.js';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { LoadingHost } from '../../components/LoadingHost.js';
import { Tooltip } from '../../components/Tooltip.js';

type TemplateItem = {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'agent';
};

function TemplateSection({
  title,
  templates,
  cloning,
  onClone,
}: {
  title: string;
  templates: TemplateItem[];
  cloning: string | null;
  onClone: (id: string) => void;
}) {
  const labels = useLabels();

  if (templates.length === 0) return null;

  return (
    <section className="template-section">
      <h3 className="rxwf-type-section-title template-section-title">{title}</h3>
      <div className="template-grid">
        {templates.map((template) => (
          <article key={template.id} className="template-card">
            <LoadingHost
              loading={cloning === template.id}
              label={t(labels, 'auto.t_1680b04b')}
            >
            <h4 className="template-card-title">{template.name}</h4>
            <Tooltip label={template.description} side="top">
              <p className="template-card-desc" tabIndex={0}>
                {template.description}
              </p>
            </Tooltip>
            <button
              type="button"
              className="btn-primary"
              disabled={cloning === template.id}
              onClick={() => onClone(template.id)}
            >
              {t(labels, 'auto.t_764ac713')}
            </button>
            </LoadingHost>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TemplateGalleryPage() {
  const labels = useLabels();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.templates
      .list()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t(labels, 'common.loadFailed'));
          setTemplates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labels]);

  const automationTemplates = useMemo(
    () => templates.filter((tpl) => tpl.category === 'automation'),
    [templates],
  );
  const agentTemplates = useMemo(
    () => templates.filter((tpl) => tpl.category === 'agent'),
    [templates],
  );

  const clone = async (id: string) => {
    setCloning(id);
    setError(null);
    try {
      const { id: workflowId } = await api.templates.clone(id);
      navigate(`/workflows/${workflowId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(labels, 'auto.t_8b9b37c1'));
    } finally {
      setCloning(null);
    }
  };

  return (
    <main className="main page">
      <header className="page-header">
        <h1 className="rxwf-type-page-title">{t(labels, 'nav.templates')}</h1>
        <p className="rxwf-type-page-lead">{t(labels, 'templates.lead')}</p>
      </header>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
      ) : (
        <>
          <TemplateSection
            title={t(labels, 'templates.section.automation')}
            templates={automationTemplates}
            cloning={cloning}
            onClone={(id) => void clone(id)}
          />
          <TemplateSection
            title={t(labels, 'templates.section.agent')}
            templates={agentTemplates}
            cloning={cloning}
            onClone={(id) => void clone(id)}
          />
        </>
      )}
    </main>
  );
}
