import { useMemo } from "react";

import { computeMarginalDensity } from "../compute/marginal-density.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarginalDensityProps = {
  /** 1-D values in the domain (e.g. x-coordinates of events in Campos 0–100). */
  values: readonly number[];
  /**
   * `"horizontal"` — domain maps across the width, density rises on the
   * perpendicular axis. Use this for a density strip along the top or
   * bottom edge of a pitch.
   *
   * `"vertical"` — domain maps across the height, density rises on the
   * perpendicular axis. Use this for a density strip along the left or
   * right edge of a pitch.
   */
  orientation: "horizontal" | "vertical";
  /** Width of the SVG in user/CSS units. */
  width: number;
  /** Height of the SVG in user/CSS units. */
  height: number;
  /** Inclusive domain endpoints in the same units as `values`. @default [0, 100] */
  domain?: [number, number];
  /**
   * Mirror the density along the cross-axis so the peak points toward the
   * opposite edge of the SVG. Useful for positioning the ridge next to a
   * pitch so the peak points away from it.
   */
  flip?: boolean;
  /**
   * Reverse the domain mapping. For a right-of-pitch vertical ridge aligning
   * with Campos y (0 = attacker's right = bottom of the pitch), set this
   * `false`. Set `true` if your layout needs the domain inverted along the
   * cross-axis.
   */
  reverse?: boolean;
  /** KDE smoothing bandwidth in domain units, or `"auto"`. @default "auto" */
  bandwidth?: number | "auto";
  /** Number of density samples along the domain. @default 128 */
  resolution?: number;
  /** Ridge fill. @default "rgba(56, 189, 248, 0.45)" */
  fill?: string;
  /** Ridge stroke. @default "rgba(56, 189, 248, 1)" */
  stroke?: string;
  /** Ridge stroke width in SVG units. @default 1 */
  strokeWidth?: number;
  /** Extra SVG-level opacity applied to the ridge. */
  opacity?: number;
  /**
   * Padding on the cross-axis (density axis) so the peak of a normalised
   * density doesn't touch the SVG edge. In SVG units. @default 2
   */
  crossAxisPadding?: number;
  /** Optional aria-label for the decorative ridge. */
  ariaLabel?: string;
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Renders a 1-D Gaussian kernel-density ridge along one edge of a pitch
 * layout. This is the primitive used to build Scout-Lab-style defensive-
 * action summaries and passing-range "marginal" panels — place it above or
 * beside a `<Pitch>` with matching width so the ridge aligns with the pitch
 * coordinate frame it is summarising.
 *
 * The component owns its own `<svg>` element; it does **not** need to be
 * rendered inside a Pitch render-prop.
 */
export function MarginalDensity({
  values,
  orientation,
  width,
  height,
  domain,
  flip = false,
  reverse = false,
  bandwidth = "auto",
  resolution = 128,
  fill = "rgba(56, 189, 248, 0.45)",
  stroke = "rgba(56, 189, 248, 1)",
  strokeWidth = 1,
  opacity,
  crossAxisPadding = 2,
  ariaLabel,
}: MarginalDensityProps) {
  const model = useMemo(
    () =>
      computeMarginalDensity({
        values,
        ...(domain != null ? { domain } : {}),
        bandwidth,
        resolution,
      }),
    [values, domain, bandwidth, resolution],
  );

  if (model.empty || width <= 0 || height <= 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`}
        style={{ display: "block" }}
        role="img"
        aria-label={ariaLabel}
      />
    );
  }

  const [d0, d1] = domain ?? [0, 100];
  const span = d1 - d0;

  const horizontal = orientation === "horizontal";
  const domainSize = horizontal ? width : height;
  const crossSize = horizontal ? height : width;
  const crossUsable = Math.max(0.1, crossSize - crossAxisPadding);

  // Map domain value → position along the "along" axis (x for horizontal, y for vertical).
  const mapAlong = (v: number) => {
    const t = (v - d0) / span;
    const adjusted = reverse ? 1 - t : t;
    return adjusted * domainSize;
  };

  // Map density 0..1 → position along the "cross" axis.
  // For horizontal: density peak points upward (small y) by default; flip=true peaks downward.
  // For vertical:   density peak points right (large x) by default; flip=true peaks left.
  const mapCross = (d: number) => {
    const peakOffset = d * crossUsable;
    if (horizontal) {
      // flip=false → peak upward (from bottom to top in SVG space)
      return flip ? peakOffset : crossSize - peakOffset;
    }
    // vertical: flip=false → peak rightward
    return flip ? crossSize - peakOffset : peakOffset;
  };

  const baseCross = horizontal ? (flip ? 0 : crossSize) : flip ? crossSize : 0;

  // Build the ridge path: points along the density, closed at the baseline.
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < model.samples.length; i += 1) {
    const along = mapAlong(model.samples[i]!);
    const cross = mapCross(model.density[i]!);
    pts.push(horizontal ? [along, cross] : [cross, along]);
  }

  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const baselineEnd = horizontal ? [last[0], baseCross] : [baseCross, last[1]];
  const baselineStart = horizontal ? [first[0], baseCross] : [baseCross, first[1]];

  const d = [
    `M${first[0].toFixed(2)},${first[1].toFixed(2)}`,
    ...pts.slice(1).map((p) => `L${p[0].toFixed(2)},${p[1].toFixed(2)}`),
    `L${baselineEnd[0]!.toFixed(2)},${baselineEnd[1]!.toFixed(2)}`,
    `L${baselineStart[0]!.toFixed(2)},${baselineStart[1]!.toFixed(2)}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      role="img"
      aria-label={ariaLabel}
      {...(opacity != null ? { opacity } : {})}
    >
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
