import type { ProjectFn } from "@withqwerty/campos-stadia";

import type { PassFlowBinModel } from "../compute/pass-flow.js";
import { roundSvg } from "./polar.js";

export type ChartFlowDestinationOverlayProps = {
  /** The active bin whose destinations should be drawn. */
  bin: PassFlowBinModel;
  project: ProjectFn;
  /** Stroke/fill colour for the overlay marks. @default "#0f172a" */
  color?: string;
  /**
   * Dot radius in pitch units. @default 0.6 (about 0.6m on a standard pitch).
   */
  dotRadius?: number;
  /**
   * If true, also draws a faint line from the bin centre to each destination
   * so the viewer can see the radial fan-out alongside the destination dots.
   * @default true
   */
  showSpokes?: boolean;
  /** Dot opacity. @default 0.85 */
  dotOpacity?: number;
  /** Spoke opacity. @default 0.22 — deliberately faint. */
  spokeOpacity?: number;
};

const DEFAULT_COLOR = "#0f172a";
const DEFAULT_DOT_RADIUS = 0.6;
const DEFAULT_DOT_OPACITY = 0.85;
const DEFAULT_SPOKE_OPACITY = 0.22;

/**
 * Foreground overlay for PassFlow: when the user hovers a bin, this primitive
 * draws every pass destination from that bin as a small dot, optionally
 * connected back to the bin centre by a faint line. It answers the "where
 * did these passes actually go?" question that a single mean-direction arrow
 * hides.
 *
 * Data comes from `bin.destinations`, which is only populated when
 * `computePassFlow` is called with `captureDestinations: true`. Rendering
 * without that flag yields an empty overlay (no-op).
 */
export function ChartFlowDestinationOverlay({
  bin,
  project,
  color = DEFAULT_COLOR,
  dotRadius = DEFAULT_DOT_RADIUS,
  showSpokes = true,
  dotOpacity = DEFAULT_DOT_OPACITY,
  spokeOpacity = DEFAULT_SPOKE_OPACITY,
}: ChartFlowDestinationOverlayProps) {
  if (bin.destinations.length === 0) return null;

  const cx = bin.x + bin.width / 2;
  const cy = bin.y + bin.height / 2;
  const origin = project(cx, cy);
  // Project a data-space offset to measure the pixel scale so dot radius
  // stays visually consistent across projections.
  const offset = project(cx + dotRadius, cy);
  const pxRadius = Math.max(0.8, Math.hypot(offset.x - origin.x, offset.y - origin.y));
  const spokeStrokeWidth = pxRadius * 0.22;
  const originX = roundSvg(origin.x);
  const originY = roundSvg(origin.y);
  const dotR = roundSvg(pxRadius);
  // Project each destination exactly once — spokes and dots share the
  // same screen-space coords, so avoid the double project() call per
  // destination on hover (can be ~170+ passes per hot bin).
  const projected = bin.destinations.map((d) => {
    const end = project(d.endX, d.endY);
    return { x: roundSvg(end.x), y: roundSvg(end.y) };
  });

  return (
    <g data-campos="passflow-destinations" style={{ pointerEvents: "none" }}>
      {showSpokes
        ? projected.map((p, i) => (
            <line
              key={`s${i}`}
              x1={originX}
              y1={originY}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={spokeStrokeWidth}
              strokeLinecap="round"
              opacity={spokeOpacity}
            />
          ))
        : null}
      {projected.map((p, i) => (
        <circle
          key={`d${i}`}
          cx={p.x}
          cy={p.y}
          r={dotR}
          fill={color}
          opacity={dotOpacity}
        />
      ))}
    </g>
  );
}
