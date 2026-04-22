import type { ReactElement } from "react";

import { DEFAULT_CARD_STYLES, estimateSmallPillWidth } from "./PlayerBadges.js";
import { markerPillCellHeight } from "./markerLayout.js";
import { registerCellSize } from "./measureProtocol.js";

/**
 * Generic rounded-rect pill with text and an optional leading icon
 * glyph. Replaces the previous thin wrappers (`AgePill`,
 * `TransferValuePill`, `SubMinuteLabel`) with a single primitive the
 * caller can drop into any slot: age goes in, transfer value goes in,
 * sub minute goes in as `"54'"`, speed goes in as `"28.8 km/h"`.
 *
 * The pill sizes itself based on the text length via the existing
 * `estimateSmallPillWidth` helper. That helper uses a deliberately
 * generous char-width factor (0.62) to keep currency glyphs like `€`
 * and `£` from clipping against the pill's rounded edges.
 *
 * **Cell size**: layout engine callers should reserve space for a pill
 * using `estimateSmallPillWidth(r, text)` for the width and
 * `markerPillCellHeight(r)` for the height. Both helpers are exported
 * from `markerLayout.ts` so the layout measurement code doesn't have
 * to reach into this file.
 */
export type MarkerPillProps = {
  /** Parent marker radius in SVG user units. */
  r: number;
  /** Text rendered inside the pill. Numbers are coerced to strings. */
  text: string | number;
  /**
   * Optional leading icon rendered inside the pill, left of the text.
   * Pass a React node (typically a tiny `<circle>` or a `<path>`) the
   * caller has already sized and positioned around `(0, 0)`. The pill
   * places the icon at the left edge and shifts the text right to
   * compensate.
   *
   * Most callers don't need this — use the separate `MarkerIcon`
   * primitive for standalone icons.
   */
  leadingIcon?: ReactElement;
  /** Background fill. Defaults to a dark pill. */
  fill?: string;
  /** Text colour. Defaults to white. */
  textColor?: string;
  /** Outline stroke colour. Omit to render without a stroke. */
  strokeColor?: string;
  /**
   * Optional `data-testid` for targeted test queries. Not required; the
   * new primitive is typically queried via slot tests (e.g.
   * `data-testid="formation-marker-slot-topRight"`), not per-pill.
   */
  testId?: string;
};

/**
 * Generic pill primitive. See {@link MarkerPillProps}.
 *
 * Usage in slot composition:
 *
 * ```tsx
 * <Formation
 *   marker={{
 *     slots: ({ player }) => ({
 *       topLeft: player.subMinute != null
 *         ? <MarkerPill r={r} text={`${player.subMinute}'`} />
 *         : null,
 *       bottomLeft: player.transferValue
 *         ? <MarkerPill r={r} text={player.transferValue} />
 *         : null,
 *     }),
 *   }}
 * />
 * ```
 */
export function MarkerPill({
  r,
  text,
  leadingIcon,
  fill = "#1a202c",
  textColor = "#ffffff",
  strokeColor,
  testId,
}: MarkerPillProps): ReactElement {
  const textStr = typeof text === "number" ? String(text) : text;
  const fontSize = r * 0.5;
  const height = r * 0.72;
  // Reserve extra horizontal room for the leading icon when one is
  // supplied. The icon itself is opaquely rendered by the caller; we
  // only care about the space it occupies.
  const iconSlotWidth = leadingIcon ? r * 0.55 : 0;
  const baseWidth = estimateSmallPillWidth(r, textStr);
  const width = baseWidth + iconSlotWidth;
  const rx = height * 0.3;
  const strokeWidth = Math.max(r * 0.05, 0.1);
  const strokeColorResolved = strokeColor ?? DEFAULT_CARD_STYLES.strokeColor;

  // When a leading icon is present the text needs to shift right by half
  // the icon slot so the visual weight stays balanced.
  const textX = leadingIcon ? iconSlotWidth / 2 : 0;
  const iconX = leadingIcon ? -width / 2 + iconSlotWidth / 2 : 0;

  return (
    <g data-testid={testId ?? "formation-marker-pill"}>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={fill}
        {...(strokeColor !== undefined
          ? { stroke: strokeColorResolved, strokeWidth }
          : {})}
      />
      {leadingIcon ? <g transform={`translate(${iconX} 0)`}>{leadingIcon}</g> : null}
      <text
        x={textX}
        y={0}
        fill={textColor}
        fontSize={fontSize}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {textStr}
      </text>
    </g>
  );
}

// Cell-size protocol registration. Mirrors the runtime width formula
// inside the component so the layout engine reserves the correct
// horizontal space without having to render the pill first.
registerCellSize(MarkerPill, (props, r) => {
  const text = (props as { text?: string | number }).text;
  const textStr = text == null ? "" : String(text);
  const baseWidth = estimateSmallPillWidth(r, textStr);
  const hasIcon = (props as { leadingIcon?: unknown }).leadingIcon != null;
  const iconSlotWidth = hasIcon ? r * 0.55 : 0;
  return {
    cellWidth: baseWidth + iconSlotWidth,
    cellHeight: markerPillCellHeight(r),
  };
});
