import type { AuthUser, SystemFeatures } from '../../api/client.js';

export type SettingsOutletContext = {
  user: AuthUser;
  features: SystemFeatures | null;
  locale: string;
  themeId: string;
  onLocaleChange: (locale: string) => void;
  onThemeChange: (themeId: string) => void;
  onUserUpdate: (patch: Partial<AuthUser>) => void;
  onLogout: () => void;
  onClose: () => void;
};
