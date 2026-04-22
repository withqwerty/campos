import { useMemo } from "react";
import type { PassEvent } from "@withqwerty/campos-schema";
import type { AttackingDirection } from "@withqwerty/campos-stadia";

import {
  computePassSonar,
  DEFAULT_PASS_SONAR_BIN_COUNT,
  roundSvg,
  wedgePath,
  type ComputePassSonarInput,
  type PassSonarBinCount,
  type PassSonarLengthBy,
  type PassSonarWedgeModel,
} from "../compute/index.js";

/**
 * Clockwise SVG rotation (in degrees) applied to the wedge group so that
 * canonical 0 rad ("toward opposition goal") points at the screen direction
 * matching the parent pitch's `attackingDirection`.
 *
 * - `"up"`    → 0°    — canonical 0 already maps to screen 12 o'clock.
 * - `"right"` → 90°   — forward wedge rotates to 3 o'clock.
 * - `"down"`  → 180°  — forward wedge rotates to 6 o'clock.
 * - `"left"`  → -90°  — forward wedge rotates to 9 o'clock.
 */
function rotationForDirection(direction: AttackingDirection): number {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return 90;
    case "down":
      return 180;
    case "left":
      return -90;
  }
}

/**
 * Props for the {@link PassSonarMarker} primitive.
 *
 * The marker is a bare SVG `<g>` with origin at the caller-supplied
 * `(x, y)`. It renders the wedges only — no guide ring, no centre hub, no
 * axis labels. Callers place it at any point inside their own SVG (e.g.
 * inside a `<Pitch>` for per-player on-pitch sonars) and pair it with
 * their own tooltip / hover handling via {@link PassSonarMarkerProps.onWedgeHover}.
 *
 * The marker reuses the same {@link computePassSonar} model as the
 * full `<PassSonar>` chart, so every compute-layer feature (bin count,
 * lengthBy, metricForPass, shared scale) is available.
 */
export type PassSonarMarkerProps = {
  passes: ReadonlyArray<PassEvent>;
  /** Centre x of the marker inside the parent SVG. */
  x: number;
  /** Centre y of the marker inside the parent SVG. */
  y: number;
  /** Outer radius in parent-SVG units. */
  radius: number;
  /** Inner radius in parent-SVG units. Default `0` (pie-slice wedges). */
  innerRadius?: number;
  /** See {@link PassSonarBinCount}. Default `24`. */
  binCount?: PassSonarBinCount;
  /** Default `"count"`. */
  lengthBy?: PassSonarLengthBy;
  /** Shared scale across a grid of markers. */
  scaleMaxAttempts?: number;
  /** Shared length scale across a grid of markers (used with `lengthBy: "mean-length"`). */
  scaleMaxLength?: number;
  /** Per-pass metric extractor. See {@link ComputePassSonarInput.metricForPass}. */
  metricForPass?: ComputePassSonarInput["metricForPass"];
  /** Subject filtering — mirrors the full `<PassSonar>` props. */
  subjectId?: string;
  subjectKind?: "player" | "team";
  /**
   * Render a wedge. Receives the wedge model plus resolved path + radius
   * geometry in parent-SVG units. Callers are responsible for the fill /
   * opacity / stroke — the primitive stays out of the way so the same
   * marker can drive frequency, distance, metric, or any custom encoding.
   *
   * Return `null` to skip rendering a bin (e.g. empty bins).
   */
  renderWedge: (ctx: PassSonarMarkerWedgeContext) => React.ReactNode;
  /**
   * Called when a wedge enters / leaves the pointer or gains focus.
   * `wedge` is `null` on leave. Use for tooltip orchestration at the
   * composition level — the primitive has no built-in tooltip state.
   */
  onWedgeHover?: (wedge: PassSonarWedgeModel | null) => void;
  /**
   * Optional centre dot rendered at `(x, y)` when passes have been
   * observed. Use to imitate the mplsoccer / Scout Lab idiom of a tiny
   * filled circle at the sonar origin. Pass `null` to skip.
   */
  centerDot?: { radius: number; fill: string } | null;
  /**
   * Attacking direction of the parent pitch. Rotates the whole wedge group so
   * canonical 0 rad ("toward the opposition goal") points at the matching
   * screen direction — 12 o'clock for `"up"`, 3 o'clock for `"right"`, etc.
   *
   * Default `"up"` preserves the standalone sonar convention (forward = top).
   * When placing markers inside a horizontal `<Pitch attackingDirection="right">`,
   * pass the same direction here so wedges stay attack-aligned with the pitch.
   */
  attackingDirection?: AttackingDirection;
  /** Optional SVG `<title>` for the whole marker. */
  ariaLabel?: string;
  /** Optional `data-*` identifier for tests. */
  testId?: string;
};

/**
 * Context passed to {@link PassSonarMarkerProps.renderWedge}. Path and
 * radius values are already in parent-SVG units.
 */
export type PassSonarMarkerWedgeContext = {
  wedge: PassSonarWedgeModel;
  /** SVG path string for the wedge. Empty string when the bin is empty. */
  attemptedPath: string;
  /** SVG path string for the completed-inside-attempted wedge. Empty when no completes. */
  completedPath: string;
  /** Outer radius actually used (in parent-SVG units). */
  outerRadius: number;
  /** Inner radius actually used (in parent-SVG units). */
  innerRadius: number;
};

function resolveRadius(
  wedge: PassSonarWedgeModel,
  lengthBy: PassSonarLengthBy,
  innerR: number,
  outerR: number,
): number {
  const track = Math.max(0, outerR - innerR);
  const ratio = lengthBy === "mean-length" ? wedge.lengthRadius : wedge.attemptedRadius;
  return innerR + ratio * track;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Headless pass-sonar SVG group suitable for placement inside any parent
 * `<svg>`. Intended for small-multiples on a pitch (per-player sonars) or
 * other compositions where the chart-frame chrome would get in the way.
 *
 * The primitive renders only what's data-driven (wedge paths + optional
 * centre dot); the caller supplies fill/stroke/opacity via
 * {@link PassSonarMarkerProps.renderWedge}. Hover / focus is reported via
 * {@link PassSonarMarkerProps.onWedgeHover} so the parent can drive a
 * shared tooltip.
 */
export function PassSonarMarker(props: PassSonarMarkerProps) {
  const {
    passes,
    x,
    y,
    radius,
    innerRadius = 0,
    binCount = DEFAULT_PASS_SONAR_BIN_COUNT,
    lengthBy = "count",
    scaleMaxAttempts,
    scaleMaxLength,
    metricForPass,
    subjectId,
    subjectKind,
    renderWedge,
    onWedgeHover,
    centerDot = null,
    attackingDirection = "up",
    ariaLabel,
    testId,
  } = props;

  const model = useMemo(
    () =>
      computePassSonar({
        passes,
        binCount,
        lengthBy,
        ...(scaleMaxAttempts != null ? { scaleMaxAttempts } : {}),
        ...(scaleMaxLength != null ? { scaleMaxLength } : {}),
        ...(metricForPass != null ? { metricForPass } : {}),
        ...(subjectId != null ? { subjectId } : {}),
        ...(subjectKind != null ? { subjectKind } : {}),
      }),
    [
      passes,
      binCount,
      lengthBy,
      scaleMaxAttempts,
      scaleMaxLength,
      metricForPass,
      subjectId,
      subjectKind,
    ],
  );

  const clampedInner = Math.max(0, Math.min(innerRadius, radius));
  const rotation = rotationForDirection(attackingDirection);
  const rotationTransform =
    rotation !== 0 ? `rotate(${rotation} ${roundSvg(x)} ${roundSvg(y)})` : undefined;

  return (
    <g
      data-testid={testId ?? "pass-sonar-marker"}
      aria-label={ariaLabel}
      role={ariaLabel != null ? "img" : undefined}
      {...(rotationTransform != null ? { transform: rotationTransform } : {})}
    >
      {model.wedges.map((wedge) => {
        const outerR = resolveRadius(wedge, lengthBy, clampedInner, radius);
        const completedR =
          clampedInner + wedge.completedRadius * Math.max(0, radius - clampedInner);
        const attemptedPath =
          wedge.attempted > 0 && outerR > clampedInner
            ? wedgePath(x, y, clampedInner, outerR, wedge.angleStart, wedge.angleEnd)
            : "";
        const completedPath =
          wedge.completed > 0 && completedR > clampedInner
            ? wedgePath(x, y, clampedInner, completedR, wedge.angleStart, wedge.angleEnd)
            : "";
        const rendered = renderWedge({
          wedge,
          attemptedPath,
          completedPath,
          outerRadius: outerR,
          innerRadius: clampedInner,
        });
        // Keep the wrapper when the caller supplies `onWedgeHover` so
        // every bin stays addressable via `data-bin-index` for
        // composition-level tooltips, even when `renderWedge` returns
        // null. When no hover handler is wired, skip empty bins.
        if (rendered == null && onWedgeHover == null) return null;
        return (
          <g
            key={wedge.binIndex}
            data-bin-index={wedge.binIndex}
            data-bin-label={wedge.label}
            onMouseEnter={
              onWedgeHover != null
                ? () => {
                    onWedgeHover(wedge);
                  }
                : undefined
            }
            onMouseLeave={
              onWedgeHover != null
                ? () => {
                    onWedgeHover(null);
                  }
                : undefined
            }
            onFocus={
              onWedgeHover != null
                ? () => {
                    onWedgeHover(wedge);
                  }
                : undefined
            }
            onBlur={
              onWedgeHover != null
                ? () => {
                    onWedgeHover(null);
                  }
                : undefined
            }
          >
            {rendered}
          </g>
        );
      })}
      {centerDot != null && !model.meta.empty ? (
        <circle
          cx={roundSvg(x)}
          cy={roundSvg(y)}
          r={centerDot.radius}
          fill={centerDot.fill}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}
