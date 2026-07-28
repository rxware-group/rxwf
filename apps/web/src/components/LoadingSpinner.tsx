export type LoadingSpinnerSize = 'sm' | 'md';

export function LoadingSpinner({
  size = 'md',
  className,
  label,
}: {
  size?: LoadingSpinnerSize;
  className?: string;
  /** Accessible name; not shown visually. */
  label?: string;
}) {
  const sizeClass = size === 'sm' ? 'loading-spinner--sm' : '';
  const classes = ['loading-spinner', sizeClass, className].filter(Boolean).join(' ');
  return (
    <span
      className={classes}
      role="status"
      aria-label={label}
      aria-live="polite"
    />
  );
}
