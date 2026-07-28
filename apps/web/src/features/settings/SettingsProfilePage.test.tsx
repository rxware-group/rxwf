import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../../i18n/labels.js';
import { SettingsProfilePage } from './SettingsProfilePage.js';
import type { AuthUser, SystemFeatures } from '../../api/client.js';
import type { SettingsOutletContext } from './settings-context.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = getLocaleBundle('zh-CN');

const user: AuthUser = {
  email: 'dev@example.com',
  role: 'admin',
  nickname: 'Dev',
};

const features: SystemFeatures = {
  deployProfile: 'standard',
  featurePlus: true,
  httpPort: 8787,
  publicUrl: 'http://localhost:8787',
  version: '0.0.0',
};

function ProfileTestHost() {
  const context: SettingsOutletContext = {
    user,
    features,
    locale: 'zh-CN',
    themeId: 'dark',
    onLocaleChange: vi.fn(),
    onThemeChange: vi.fn(),
    onUserUpdate: vi.fn(),
    onLogout: vi.fn(),
    onClose: vi.fn(),
  };

  return (
    <MemoryRouter initialEntries={['/settings/profile']}>
      <Routes>
        <Route path="/settings" element={<Outlet context={context} />}>
          <Route path="profile" element={<SettingsProfilePage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SettingsProfilePage', () => {
  it('does not render language or theme controls', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <LabelsProvider labels={labels}>
          <ProfileTestHost />
        </LabelsProvider>,
      );
    });

    expect(document.body.textContent).not.toContain('界面语言与配色主题');
    expect(document.body.querySelector('select')).toBeNull();

    root.unmount();
    host.remove();
  });
});
