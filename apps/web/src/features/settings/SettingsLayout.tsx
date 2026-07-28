import { t, useLabels } from '../../i18n/labels.js';
import { useRef } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import type { SettingsOutletContext } from './settings-context.js';
import { SettingsNav } from './SettingsNav.js';
import { useSettingsSplitter } from './use-settings-splitter.js';

export function SettingsLayout() {
  const labels = useLabels();

  const ctx = useOutletContext<SettingsOutletContext>();
  const containerRef = useRef<HTMLDivElement>(null);
  const { navWidthPct, startNavDrag } = useSettingsSplitter();

  return (
    <div className="settings-layout">
      <div ref={containerRef} className="settings-split-container">
        <aside className="settings-nav-pane" style={{ width: `${navWidthPct}%` }}>
          <SettingsNav user={ctx.user} features={ctx.features} />
        </aside>
        <div
          className="settings-splitter settings-splitter--col"
          role="separator"
          aria-orientation="vertical"
          aria-label={t(labels, 'settings.nav.resize')}
          onMouseDown={(e) => startNavDrag(e, containerRef.current)}
        />
        <div className="settings-content">
          <Outlet context={ctx} />
        </div>
      </div>
    </div>
  );
}
