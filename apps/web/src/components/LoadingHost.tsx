import type { CSSProperties, ReactNode } from 'react';
import { LoadingOverlay } from './LoadingOverlay.js';

export function LoadingHost({
  loading,
  children = null,
  fullScreen = false,
  minHeight,
  label,
  className,
  style,
}: {
  loading: boolean;
  children?: ReactNode;
  fullScreen?: boolean;
  minHeight?: CSSProperties['minHeight'];
  /** Accessible name passed to the overlay spinner. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const hostClass = [
    'loading-host',
    fullScreen ? 'loading-host--fullscreen' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hostStyle: CSSProperties = { ...style };
  if (minHeight != null) {
    hostStyle.minHeight = minHeight;
  }

  return (
    <div className={hostClass} style={hostStyle} aria-busy={loading || undefined}>
      {children}
      {loading && <LoadingOverlay fullScreen={fullScreen} label={label} />}
    </div>
  );
}
