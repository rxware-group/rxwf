import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import type { SettingsOutletContext } from './settings-context.js';

export function AdminGuard() {
  const ctx = useOutletContext<SettingsOutletContext>();
  if (ctx.user.role !== 'admin') {
    return <Navigate to="/settings" replace />;
  }
  return <Outlet context={ctx} />;
}
