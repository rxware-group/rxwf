import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { readThemeToken, useThemeVersion } from '../../hooks/use-theme-id.js';

const SIZE = 14;

type IconVariant = 'default' | 'hover' | 'pressed' | 'disabled';

function IconLayer({ variant, children }: { variant: IconVariant; children: ReactNode }) {
  return (
    <span className={`workflow-node-btn-icon workflow-node-btn-icon--${variant}`} aria-hidden>
      {children}
    </span>
  );
}

function PlaySvg({ fill }: { fill: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill={fill}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PowerSvg({ stroke }: { stroke: string }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.77 0" />
    </svg>
  );
}

function TrashSvg({ stroke }: { stroke: string }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14H5V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function MoreSvg({ fill }: { fill: string }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill={fill}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function ToolbarIconStack({
  defaultIcon,
  hoverIcon,
  pressedIcon,
  disabledIcon,
}: {
  defaultIcon: ReactNode;
  hoverIcon: ReactNode;
  pressedIcon: ReactNode;
  disabledIcon: ReactNode;
}) {
  return (
    <>
      <IconLayer variant="default">{defaultIcon}</IconLayer>
      <IconLayer variant="hover">{hoverIcon}</IconLayer>
      <IconLayer variant="pressed">{pressedIcon}</IconLayer>
      <IconLayer variant="disabled">{disabledIcon}</IconLayer>
    </>
  );
}

/** 节点工具栏：四态图标（default / hover / pressed / disabled） */
export function PlayToolbarIcon() {
  const themeVersion = useThemeVersion();
  const accent = useMemo(() => readThemeToken('--rxwf-accent', '#f97316'), [themeVersion]);
  const focusSoft = useMemo(() => readThemeToken('--rxwf-focus-soft', '#fb923c'), [themeVersion]);
  const accentHover = useMemo(() => readThemeToken('--rxwf-accent-hover', '#ea580c'), [themeVersion]);

  return (
    <ToolbarIconStack
      defaultIcon={<PlaySvg fill={focusSoft} />}
      hoverIcon={<PlaySvg fill={accent} />}
      pressedIcon={<PlaySvg fill={accentHover} />}
      disabledIcon={<PlaySvg fill="#484f58" />}
    />
  );
}

export function PowerToolbarIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <ToolbarIconStack
        defaultIcon={<PowerSvg stroke="#6e7681" />}
        hoverIcon={<PowerSvg stroke="#8b949e" />}
        pressedIcon={<PowerSvg stroke="#484f58" />}
        disabledIcon={<PowerSvg stroke="#484f58" />}
      />
    );
  }
  return (
    <ToolbarIconStack
      defaultIcon={<PowerSvg stroke="#c9d1d9" />}
      hoverIcon={<PowerSvg stroke="#ffffff" />}
      pressedIcon={<PowerSvg stroke="#8b949e" />}
      disabledIcon={<PowerSvg stroke="#484f58" />}
    />
  );
}

export function TrashToolbarIcon() {
  return (
    <ToolbarIconStack
      defaultIcon={<TrashSvg stroke="#f87171" />}
      hoverIcon={<TrashSvg stroke="#fca5a5" />}
      pressedIcon={<TrashSvg stroke="#dc2626" />}
      disabledIcon={<TrashSvg stroke="#484f58" />}
    />
  );
}

export function MoreToolbarIcon() {
  const themeVersion = useThemeVersion();
  const accent = useMemo(() => readThemeToken('--rxwf-accent', '#f97316'), [themeVersion]);

  return (
    <ToolbarIconStack
      defaultIcon={<MoreSvg fill="#8b949e" />}
      hoverIcon={<MoreSvg fill="#e6edf3" />}
      pressedIcon={<MoreSvg fill={accent} />}
      disabledIcon={<MoreSvg fill="#484f58" />}
    />
  );
}

/** 连线删除等单态场景 */
export function IconTrash() {
  return <TrashSvg stroke="currentColor" />;
}
