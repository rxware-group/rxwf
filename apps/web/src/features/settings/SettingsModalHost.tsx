import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SettingsModal } from './SettingsModal.js';
import type { SettingsOutletContext } from './settings-context.js';
import { settingsCloseTarget } from './settings-location-state.js';

export function SettingsModalHost(props: Omit<SettingsOutletContext, 'onClose'>) {
  const location = useLocation();
  const navigate = useNavigate();

  const onClose = () => {
    const target = settingsCloseTarget(location.state);
    navigate(target, { replace: true });
  };

  const outletContext: SettingsOutletContext = { ...props, onClose };

  return (
    <SettingsModal onClose={onClose}>
      <Outlet context={outletContext} />
    </SettingsModal>
  );
}
