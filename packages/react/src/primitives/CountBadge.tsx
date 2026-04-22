import type { ReactElement } from "react";

import { registerCellSize } from "./measureProtocol.js";

/**
 * Badge disc containing an icon, with an optional notification-style
 * count pip superimposed in the upper-right corner when `count >= 2`.
 *
 * This is the LiveScore / SofaScore approach to multi-goal / multi-assist
 * display: one football icon + a small "2" numeral pip, instead of
 * stacking 2 separate badges.
 *
 * The pip intentionally bleeds outside the badge disc — like a mobile
 * notification badge — so the layout cell size only budgets for the
 * main disc, not the pip overflow.
 */

/** Badge disc diameter as a fraction of the parent marker radius. */
const BADGE_SIZE = 0.75;

export type CountBadgeProps = {
  /** Parent marker radius in SVG user units. */
  r: number;
  /** Icon rendered at the centre of the badge disc. */
  icon: ReactElement;
  /** Count value. Pip only renders when >= 2. */
  count: number;
  /** Badge disc fill. */
  fill?: string;
  /** Badge disc stroke colour. */
  strokeColor?: string;
  /** Pip fill colour (the small count circle). */
  countFill?: string;
  /** Pip text colour. */
  countTextColor?: string;
  /** Optional data-testid. */
  testId?: string;
};

export function CountBadge({
  r,
  icon,
  count,
  fill = "#ffffff",
  strokeColor = "#1a202c",
  countFill = "#e50027",
  countTextColor = "#ffffff",
  testId,
}: CountBadgeProps): ReactElement {
  const badgeR = (r * BADGE_SIZE) / 2;
  const pipR = r * 0.22;
  const pipCx = badgeR * 0.7;
  const pipCy = -(badgeR * 0.7);
  const fontSize = pipR * 1.3;

  return (
    <g data-testid={testId}>
      <circle r={badgeR} fill={fill} stroke={strokeColor} strokeWidth={0.15} />
      {icon}
      {count >= 2 ? (
        <g transform={`translate(${pipCx} ${pipCy})`}>
          <circle
            r={pipR}
            fill={countFill}
            stroke={strokeColor}
            strokeWidth={Math.max(r * 0.04, 0.08)}
          />
          <text
            x={0}
            y={0}
            fill={countTextColor}
            fontSize={fontSize}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            pointerEvents="none"
            style={{ userSelect: "none" }}
          >
            {count}
          </text>
        </g>
      ) : null}
    </g>
  );
}

registerCellSize(CountBadge, (_props, r) => ({
  cellWidth: r * BADGE_SIZE,
  cellHeight: r * BADGE_SIZE,
}));
