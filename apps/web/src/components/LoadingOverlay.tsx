import { LoadingSpinner } from './LoadingSpinner.js';

export function LoadingOverlay({
  fullScreen = false,
  label,
  className,
}: {
  fullScreen?: boolean;
  /** Accessible name for the spinner. */
  label?: string;
  className?: string;
}) {
  const classes = [
    'loading-overlay',
    fullScreen ? 'loading-overlay--fullscreen' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} aria-busy="true">
      <LoadingSpinner label={label} />
    </div>
  );
}
