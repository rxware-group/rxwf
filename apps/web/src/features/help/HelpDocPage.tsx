import { Link, useLocation } from 'react-router-dom';
import { t, useLabels } from '../../i18n/labels.js';
import { helpPathFromSlug } from './help-registry.js';
import { HelpMarkdown } from './HelpMarkdown.js';
import { getHelpDoc } from './load-help-doc.js';

export function HelpDocPage() {
  const labels = useLabels();
  const location = useLocation();
  const slug = location.pathname.replace(/^\/help\/?/, '');
  const content = getHelpDoc(slug);

  if (!content) {
    return (
      <div className="help-doc-page help-doc-page--missing">
        <h1>{t(labels, 'help.notFound')}</h1>
        <p className="hint">{slug ? `/help/${slug}` : '/help'}</p>
        <Link className="help-doc-home-link" to="/help">
          {t(labels, 'help.nav.home')}
        </Link>
      </div>
    );
  }

  return (
    <article className="help-doc-page">
      <HelpMarkdown content={content} />
    </article>
  );
}

export function helpDocPathActive(slug: string, pathname: string): boolean {
  return helpPathFromSlug(slug) === pathname || (slug === '' && pathname === '/help');
}
