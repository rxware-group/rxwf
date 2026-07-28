import type { CSSProperties, ComponentType } from 'react';
import { CodeNodeIcon } from './CodeNodeIcon.js';
import { IfBranchIcon } from './IfBranchIcon.js';
import { SwitchBranchIcon } from './SwitchBranchIcon.js';
import type { NodeTypeMeta } from './node-type-meta.js';

const SVG_NODE_ICONS: Record<string, ComponentType> = {
  if: IfBranchIcon,
  switch: SwitchBranchIcon,
  code: CodeNodeIcon,
};

export function NodeIconGlyph({
  type,
  meta,
  className,
  style,
}: {
  type: string;
  meta: NodeTypeMeta;
  className?: string;
  style?: CSSProperties;
}) {
  const colorStyle: CSSProperties = {
    ['--node-accent' as string]: meta.accent,
    ...style,
  };
  const SvgIcon = SVG_NODE_ICONS[type];

  if (SvgIcon) {
    return (
      <span className={className} style={colorStyle}>
        <SvgIcon />
      </span>
    );
  }

  return (
    <span className={className} style={colorStyle}>
      {meta.icon}
    </span>
  );
}
