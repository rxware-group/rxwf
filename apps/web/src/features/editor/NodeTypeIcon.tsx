import type { NodeTypeMeta } from './node-type-meta.js';
import { NodeIconGlyph } from './NodeIconGlyph.js';

/** 图标直接叠在节点背景上，无内层色块 */
export function NodeTypeIcon({ type, meta }: { type: string; meta: NodeTypeMeta }) {
  return (
    <span
      className={`workflow-node-icon-plate workflow-node-icon-plate--${meta.category}`}
      style={{ '--node-accent': meta.accent } as React.CSSProperties}
      aria-hidden
    >
      <NodeIconGlyph type={type} meta={meta} className="rxwf-node-glyph rxwf-node-glyph--canvas" />
    </span>
  );
}
