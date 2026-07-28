import { Link, useLocation, useNavigate } from 'react-router-dom';
import { t, useLabels } from '../../i18n/labels.js';
import { HelpDocPage } from './HelpDocPage.js';
import { HelpNavTree } from './HelpNavTree.js';
import { HELP_NAV } from './help-nav.js';

export function HelpLayout() {
  const labels = useLabels();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="help-center">
      <header className="help-center-header">
        <div className="help-center-header-start">
          <Link className="help-center-brand" to="/">
            RX-Workflow
          </Link>
          <span className="help-center-title">{t(labels, 'help.title')}</span>
        </div>
        <button
          type="button"
          className="help-center-back-btn"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
              return;
            }
            navigate('/');
          }}
        >
          {t(labels, 'help.back')}
        </button>
      </header>
      <div className="help-center-body">
        <nav className="help-center-nav" aria-label={t(labels, 'help.title')}>
          <HelpNavTree pathname={location.pathname} items={HELP_NAV} />
        </nav>
        <main className="help-center-main">
          <HelpDocPage />
        </main>
      </div>
    </div>
  );
}
