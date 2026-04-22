import type { ReactElement } from "react";

import { registerCellSize } from "./measureProtocol.js";

/**
 * Raw coloured dot — a minimal card/event indicator used by the
 * LiveScore preset style. Just a small filled circle in the card
 * colour, with no shaped card icon or badge wrapper.
 *
 * ```tsx
 * slots: ({ r }) => ({
 *   left: player.yellowCard ? <DotIndicator r={r} color="#facc15" /> : null,
 * })
 * ```
 */
export type DotIndicatorProps = {
  /** Parent marker radius — drives the dot size. */
  r: number;
  /** Dot fill colour (e.g. "#dc2626" for red, "#facc15" for yellow). */
  color: string;
  /** Outline stroke colour. */
  strokeColor?: string;
};

export function DotIndicator({
  r,
  color,
  strokeColor = "#1a202c",
}: DotIndicatorProps): ReactElement {
  const dotR = r * 0.22;
  return (
    <circle
      r={dotR}
      fill={color}
      stroke={strokeColor}
      strokeWidth={Math.max(r * 0.04, 0.08)}
    />
  );
}

registerCellSize(DotIndicator, (_props, r) => {
  const dotR = r * 0.22;
  return { cellWidth: dotR * 2, cellHeight: dotR * 2 };
});
