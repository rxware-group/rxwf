import {
  Link,
  NavLink,
  useLocation,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom';
import {
  getSettingsBackground,
  type SettingsModalLocationState,
} from './settings-location-state.js';

function linkState(
  locationState: unknown,
  extra?: SettingsModalLocationState,
): SettingsModalLocationState | undefined {
  const background = getSettingsBackground(locationState);
  const merged = background
    ? { background, ...extra }
    : extra;
  return merged && Object.keys(merged).length > 0 ? merged : undefined;
}

export function SettingsLink({
  state,
  ...props
}: LinkProps) {
  const location = useLocation();
  return (
    <Link
      {...props}
      state={linkState(location.state, state as SettingsModalLocationState | undefined)}
    />
  );
}

export function SettingsNavLink({
  state,
  ...props
}: NavLinkProps) {
  const location = useLocation();
  return (
    <NavLink
      {...props}
      state={linkState(location.state, state as SettingsModalLocationState | undefined)}
    />
  );
}
