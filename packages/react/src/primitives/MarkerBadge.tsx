import type { ReactElement, ReactNode } from "react";

import { registerCellSize } from "./measureProtocol.js";

/**
 * Small circular badge that wraps any icon, text, or glyph for the
 * slot composition system. Every slot decoration in the reference
 * broadcast images sits inside a tight dark disc — this primitive
 * provides that disc so callers don't have to repeat the circle +
 * clip + centering boilerplate per slot.
 *
 * The badge is sized by `size` (disc diameter in SVG user units) and
 * centres its children at (0, 0). The caller drops `<MarkerBadge>` into
 * a slot and passes an icon or text as children:
 *
 * ```tsx
 * slots: ({ r }) => ({
 *   bottomRight: <MarkerBadge size={r * 0.7} fill="#1a202c">
 *     <FootballFillIcon size={r * 0.45} color="#fff" ... />
 *   </MarkerBadge>,
 * })
 * ```
 */
export type MarkerBadgeProps = {
  /** Disc diameter in SVG user units. */
  size: number;
  /** Disc fill colour. Defaults to the standard dark stroke colour. */
  fill?: string;
  /** Disc stroke colour. Omit for no outline. */
  strokeColor?: string;
  /** Disc stroke width. Defaults to 0. */
  strokeWidth?: number;
  /** Content rendered at the centre of the disc. */
  children?: ReactNode;
  /** Optional `data-testid` for assertions. */
  testId?: string;
};

export function MarkerBadge({
  size,
  fill = "#ffffff",
  strokeColor = "#1a202c",
  strokeWidth = 0.15,
  children,
  testId,
}: MarkerBadgeProps): ReactElement {
  const r = size / 2;
  return (
    <g data-testid={testId}>
      <circle r={r} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
      {children}
    </g>
  );
}

// Cell-size protocol: the badge is a square of `size × size`.
registerCellSize(MarkerBadge, (props, _r) => {
  const size = (props as { size?: number }).size ?? _r;
  return { cellWidth: size, cellHeight: size };
});
