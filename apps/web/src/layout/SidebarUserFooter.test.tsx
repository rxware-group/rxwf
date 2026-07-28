import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getLocaleBundle } from '@rxwf/i18n-catalog';
import { LabelsProvider } from '../i18n/labels.js';
import { SidebarUserFooter } from './SidebarUserFooter.js';
import type { AuthUser, SystemFeatures } from '../api/client.js';

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

function renderFooter(
  props: Partial<{
    locale: string;
    themeId: string;
    onLocaleChange: (locale: string) => void;
    onThemeChange: (themeId: string) => void;
  }> = {},
) {
  const onLocaleChange = props.onLocaleChange ?? vi.fn();
  const onThemeChange = props.onThemeChange ?? vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <MemoryRouter>
        <LabelsProvider labels={labels}>
          <SidebarUserFooter
            user={user}
            features={features}
            locale={props.locale ?? 'zh-CN'}
            themeId={props.themeId ?? 'dark'}
            onLocaleChange={onLocaleChange}
            onThemeChange={onThemeChange}
            onLogout={vi.fn()}
          />
        </LabelsProvider>
      </MemoryRouter>,
    );
  });

  return { host, root, onLocaleChange, onThemeChange };
}

function openMenu() {
  const avatarBtn = document.body.querySelector('.sidebar-user-avatar-btn') as HTMLButtonElement;
  act(() => {
    avatarBtn.click();
  });
}

function menuItemLabels(): string[] {
  return Array.from(document.body.querySelectorAll('.sidebar-user-menu > .sidebar-user-menu-row'))
    .map((row) => row.querySelector('.sidebar-user-menu-label')?.textContent?.trim() ?? '');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SidebarUserFooter', () => {
  it('shows language and theme before settings, help, and logout', () => {
    renderFooter();
    openMenu();
    expect(menuItemLabels()).toEqual(['语言', '主题', '设置', '帮助', '登出']);
  });

  it('marks the current locale and theme in submenus', () => {
    renderFooter({ locale: 'en-US', themeId: 'light' });
    openMenu();

    const languageRow = document.body.querySelector('[data-submenu="language"]');
    act(() => {
      (languageRow!.querySelector('.sidebar-user-menu-item') as HTMLButtonElement).click();
    });
    const localeChecks = languageRow!.querySelectorAll('.sidebar-user-submenu-item.is-selected');
    expect(localeChecks).toHaveLength(1);
    expect(localeChecks[0]?.textContent).toContain('English');

    const themeRow = document.body.querySelector('[data-submenu="theme"]');
    act(() => {
      (themeRow!.querySelector('.sidebar-user-menu-item') as HTMLButtonElement).click();
    });
    const themeChecks = themeRow!.querySelectorAll('.sidebar-user-submenu-item.is-selected');
    expect(themeChecks).toHaveLength(1);
    expect(themeChecks[0]?.textContent).toContain('浅色');
  });

  it('calls preference handlers when selecting submenu options', () => {
    const { onLocaleChange, onThemeChange } = renderFooter();
    openMenu();

    const languageRow = document.body.querySelector('[data-submenu="language"]');
    act(() => {
      (languageRow!.querySelector('.sidebar-user-menu-item') as HTMLButtonElement).click();
    });
    const enOption = Array.from(
      languageRow!.querySelectorAll('.sidebar-user-submenu-item'),
    ).find((el) => el.textContent?.includes('English')) as HTMLButtonElement;
    act(() => {
      enOption.click();
    });
    expect(onLocaleChange).toHaveBeenCalledWith('en-US');

    openMenu();
    const themeRow = document.body.querySelector('[data-submenu="theme"]');
    act(() => {
      (themeRow!.querySelector('.sidebar-user-menu-item') as HTMLButtonElement).click();
    });
    const lightOption = Array.from(
      themeRow!.querySelectorAll('.sidebar-user-submenu-item'),
    ).find((el) => el.textContent?.includes('浅色')) as HTMLButtonElement;
    act(() => {
      lightOption.click();
    });
    expect(onThemeChange).toHaveBeenCalledWith('light');
  });
});
