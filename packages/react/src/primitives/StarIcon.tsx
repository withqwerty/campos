import type { ReactElement } from "react";

import { registerCellSize } from "./measureProtocol.js";

/**
 * 5-point star icon for Man of the Match indicators. Renders as a
 * raw gold polygon — no badge wrapper, sits directly on the marker.
 *
 * ```tsx
 * slots: ({ r }) => ({ topRight: <StarIcon r={r * 0.4} /> })
 * ```
 */
export type StarIconProps = {
  /** Outer radius of the star in SVG user units. */
  r: number;
  /** Star fill colour. Defaults to gold. */
  fill?: string;
  /** Outline stroke colour. */
  strokeColor?: string;
};

export function StarIcon({
  r: starR,
  fill = "#fbbf24",
  strokeColor = "#1a202c",
}: StarIconProps): ReactElement {
  const pts: string[] = [];
  const inner = starR * 0.42;
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? starR : inner;
    pts.push(
      `${(rad * Math.cos(angle)).toFixed(3)},${(rad * Math.sin(angle)).toFixed(3)}`,
    );
  }
  return (
    <polygon
      data-testid="formation-motm"
      points={pts.join(" ")}
      fill={fill}
      stroke={strokeColor}
      strokeWidth={Math.max(starR * 0.08, 0.1)}
      strokeLinejoin="round"
    />
  );
}

registerCellSize(StarIcon, (_props, r) => ({
  cellWidth: r * 0.8,
  cellHeight: r * 0.8,
}));
