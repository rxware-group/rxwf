import { t, useLabels } from '../../i18n/labels.js';
import type { SystemFeatures } from '../../api/client.js';

export function SettingsIndexPage({
 features }: { features: SystemFeatures | null }) {
  const labels = useLabels();

  return (
    <div className="settings-page">
      <p className="hint settings-page-lead">{t(labels, 'settings.index.lead')}</p>
      <section className="panel settings-panel">
        <dl className="settings-dl">
          <dt>{t(labels, 'auto.t_989d1aff')}</dt>
          <dd>{features?.version ?? '…'}</dd>
          <dt>{t(labels, 'settings.index.deployProfile')}</dt>
          <dd>{features?.deployProfile ?? '…'}</dd>
          <dt>{t(labels, 'settings.index.httpPort')}</dt>
          <dd>{features?.httpPort ?? 8787}</dd>
          <dt>{t(labels, 'settings.index.publicUrl')}</dt>
          <dd className="mono">{features?.publicUrl ?? '—'}</dd>
        </dl>
      </section>
    </div>
  );
}
