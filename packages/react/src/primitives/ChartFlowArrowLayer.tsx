import type { ProjectFn } from "@withqwerty/campos-stadia";

import type {
  PassFlowBinModel,
  PassFlowLowDispersionGlyph,
} from "../compute/pass-flow.js";
import { roundSvg } from "./polar.js";

export type PassFlowArrowColor = string | ((bin: PassFlowBinModel) => string);

/** Per-bin colour callback for the low-dispersion glyph. */
export type PassFlowGlyphColor = string | ((bin: PassFlowBinModel) => string);

/**
 * Cartographic halo around arrows + glyphs. The halo is rendered as an
 * additional underlay stroke (slightly wider, behind the foreground
 * stroke) — the canonical map-label legibility pattern, here adapted for
 * SVG strokes since `paint-order` only sequences fill/stroke per element.
 *
 * `color` is a per-bin callback so the halo can pick its own contrast
 * (typically the opposite end of the arrow's contrast pair).
 *
 * `width` is a multiplier on top of the bin's resolved arrow stroke width
 * — the halo's visible "ring" thickness is roughly `(width - 1) * arrowStroke`.
 */
export type PassFlowHalo = {
  color: (bin: PassFlowBinModel) => string;
  /** Multiplier on the arrow's resolved stroke width. @default 2.5 */
  width: number;
};

/**
 * Arrow animation mode.
 *   - `"none"` — arrows are static (default).
 *   - `"dashes"` — all arrow lines render as dashed strokes that flow
 *     along their length (CSS `stroke-dashoffset` animation). Suggests the
 *     "passing field" metaphor without moving individual data points.
 *   - `"dashes-on-hover"` — only the active bin's arrow animates.
 *
 * All modes respect `prefers-reduced-motion: reduce`, where they disable
 * the animation automatically.
 */
export type PassFlowAnimate = "none" | "dashes" | "dashes-on-hover";

/**
 * Filter-transition animation mode. When enabled, arrows smoothly
 * reposition to the new mean direction when a prop-driven filter change
 * (e.g. `directionFilter`, `periodFilter`) re-runs the compute. Every bin's
 * `<line>` is always rendered — opacity fades it out when the gate
 * fails — so React matches elements across renders and CSS transitions
 * can fire on the geometry attrs.
 */
export type PassFlowFilterTransition = "none" | "morph";

export type ChartFlowArrowLayerProps = {
  bins: readonly PassFlowBinModel[];
  project: ProjectFn;
  /** Fraction of min(binW, binH) an arrow may span at `magnitudeHint = 1`. Default 0.8. */
  arrowContainment?: number;
  /** Glyph rendered when `bin.lowDispersion === true`. Default `"circle"`. */
  lowDispersionGlyph?: PassFlowLowDispersionGlyph;
  /**
   * Arrow stroke colour. Scalar for a single colour, or a callback for
   * per-bin colouring (e.g. map bin volume to a cmap).
   * @default "#0f172a"
   */
  color?: PassFlowArrowColor;
  /** Arrow stroke width in pitch units. Default scales with bin size. */
  strokeWidth?: number;
  /**
   * Low-dispersion glyph colour. Falls back to the resolved arrow colour
   * when omitted. Accepts a scalar or a per-bin callback so glyphs can
   * pick contrast against their own bin fill.
   */
  glyphColor?: PassFlowGlyphColor;
  /**
   * Optional cartographic halo for arrows + glyphs — survives any
   * background colour without per-bin contrast computation. See
   * `PassFlowHalo` for shape.
   */
  halo?: PassFlowHalo;
  /** Arrowhead width/height as a multiple of strokeWidth. Default 3. */
  arrowheadScale?: number;
  /**
   * Stable prefix for the SVG `<marker>` ids. Multiple `<marker>` defs are
   * emitted when `color` is a callback — one per unique resolved colour.
   */
  arrowheadId: string;
  /** Marching-dashes animation mode. @default "none" */
  animate?: PassFlowAnimate;
  /**
   * Bin key (`"row-col"`) that should be treated as "hovered" for the
   * `dashes-on-hover` animation mode. Typically the `activeBinKey` the
   * component tracks for the tooltip.
   */
  activeBinKey?: string | null;
  /**
   * Filter-transition animation mode. When `"morph"`, every bin always
   * renders as a `<line>` / glyph pair so CSS transitions can morph them
   * across prop changes rather than hard-swapping. @default "none"
   */
  filterTransition?: PassFlowFilterTransition;
};

const DEFAULT_COLOR = "#0f172a";
// Stroke and arrowhead sizes are in pitch viewBox units (≈ metres). They
// scale with bin size so coarse grids (3×2) get chunky arrows and fine
// grids (16×10) get fine ones. `markerUnits="strokeWidth"` makes the head
// follow the line stroke automatically.
const STROKE_RATIO = 0.025; // fraction of min(binW, binH) used as stroke width
const MIN_STROKE = 0.15; // m — keep visible on the densest grids
const MAX_STROKE = 0.8; // m — keep proportional on a 1×1 grid
const DEFAULT_ARROWHEAD_SCALE = 3;
const DEFAULT_CONTAINMENT = 0.8;
const GLYPH_RADIUS_FRAC = 0.1; // fraction of min(binW, binH) for the glyph
const DEFAULT_FILTER_TRANSITION_MS = 320;

/**
 * CSS injected once per layer instance. Uses CSS custom-property selectors
 * so the dashes animation and the morph transition can be toggled
 * independently without style-attribute noise per line.
 *
 * Generated with `roundSvg`'s precision to stay SSR-deterministic.
 */
function layerStyles(scope: string): string {
  return `
    [data-campos-animate-scope="${scope}"][data-campos-animate="dashes"] line[data-bin-col],
    [data-campos-animate-scope="${scope}"][data-campos-animate="dashes-on-hover"] line[data-bin-col][data-active="1"] {
      stroke-dasharray: 3 2;
      animation: campos-passflow-dashflow 1200ms linear infinite;
    }
    @keyframes campos-passflow-dashflow {
      from { stroke-dashoffset: 5; }
      to { stroke-dashoffset: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-campos-animate-scope="${scope}"] line[data-bin-col] {
        animation: none;
      }
    }
    [data-campos-morph-scope="${scope}"] line[data-bin-col],
    [data-campos-morph-scope="${scope}"] circle[data-bin-col] {
      transition:
        x1 ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        y1 ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        x2 ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        y2 ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        cx ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        cy ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        r ${DEFAULT_FILTER_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity ${DEFAULT_FILTER_TRANSITION_MS}ms ease-out;
    }
    @media (prefers-reduced-motion: reduce) {
      [data-campos-morph-scope="${scope}"] line[data-bin-col],
      [data-campos-morph-scope="${scope}"] circle[data-bin-col] {
        transition: none;
      }
    }
  `;
}

/**
 * SVG-safe id suffix from a CSS colour (hex, rgb(), named). Strips
 * everything that isn't `[A-Za-z0-9]` so the output is always a valid id
 * fragment.
 */
function colorIdSuffix(color: string): string {
  const safe = color.replace(/[^a-zA-Z0-9]/g, "");
  return safe.length > 0 ? safe : "arrow";
}

/**
 * Renders the arrow / low-dispersion-glyph layer for PassFlow. Purely
 * presentational — all gating decisions and directional math already
 * resolved in `computePassFlow`. This component only converts data-space
 * geometry to SVG pixels via `project`.
 *
 * Arrow length is computed in data space as
 * `magnitudeHint × arrowContainment × min(binW, binH)`, then both endpoints
 * are projected. This keeps rotation/flip semantics correct under any
 * `attackingDirection`.
 *
 * When `filterTransition="morph"`, every bin always renders both the line
 * and the glyph (hidden via opacity). That lets CSS transitions on SVG
 * geometry attrs fire when props change — arrows smoothly morph to the
 * new mean direction instead of jump-cutting.
 */
export function ChartFlowArrowLayer({
  bins,
  project,
  arrowContainment = DEFAULT_CONTAINMENT,
  lowDispersionGlyph = "circle",
  color = DEFAULT_COLOR,
  strokeWidth,
  glyphColor,
  halo,
  arrowheadScale = DEFAULT_ARROWHEAD_SCALE,
  arrowheadId,
  animate = "none",
  activeBinKey = null,
  filterTransition = "none",
}: ChartFlowArrowLayerProps) {
  /** Stroke width for a bin, in pitch units; scales with cell size. */
  const strokeFor = (bin: PassFlowBinModel): number => {
    if (strokeWidth != null) return strokeWidth;
    const bySize = STROKE_RATIO * Math.min(bin.width, bin.height);
    return Math.min(MAX_STROKE, Math.max(MIN_STROKE, bySize));
  };

  /** Resolve arrow colour for a bin, scalar or callback. */
  const colorFor = (bin: PassFlowBinModel): string =>
    typeof color === "function" ? color(bin) : color;

  /** Resolve glyph colour for a bin, scalar or callback. */
  const glyphColorFor = (bin: PassFlowBinModel): string => {
    if (typeof glyphColor === "function") return glyphColor(bin);
    if (typeof glyphColor === "string") return glyphColor;
    return colorFor(bin);
  };

  /**
   * Unique arrowhead colours → deterministic marker id per colour. Only
   * bins that will actually draw an arrow contribute a marker (even in
   * morph mode — an empty bin's `<line>` is rendered at opacity 0 without
   * a markerEnd, so it doesn't need a `<marker>`). Skipping count=0 bins
   * here also prevents `arrowColor` callbacks from being invoked on
   * degenerate bins (meanAngle=null, directionCount=0 etc.), which tends
   * to produce NaN-derived CSS colours.
   */
  const markerByColor = new Map<string, string>();
  for (const bin of bins) {
    if (!bin.hasArrow || bin.count === 0) continue;
    const c = colorFor(bin);
    if (!markerByColor.has(c)) {
      markerByColor.set(c, `${arrowheadId}-${colorIdSuffix(c)}`);
    }
  }
  // Always emit at least one fallback marker so `markerEnd` references
  // never resolve to undefined. For scalar colour, use the scalar. For a
  // callback, use `DEFAULT_COLOR` — the callback is never invoked with
  // no valid bin. This branch also keeps the static scalar-colour case
  // emitting a marker even if no bin passes the arrow gate.
  const fallbackColor = typeof color === "string" ? color : DEFAULT_COLOR;
  if (!markerByColor.has(fallbackColor)) {
    markerByColor.set(fallbackColor, `${arrowheadId}-${colorIdSuffix(fallbackColor)}`);
  }
  const fallbackMarkerId = markerByColor.get(fallbackColor)!;

  /**
   * When haloing is on, build a parallel marker map for the halo
   * colours. The halo line gets its own `markerEnd` so the arrowhead is
   * rendered both at halo width (drawn behind) and arrow width (on top),
   * forming a contrasting outline around the arrow tip. Without this,
   * the halo line's fat stroke hides the arrow marker entirely when the
   * halo width is ≥ arrow markerWidth (which is the common case).
   */
  const haloMarkerByColor = new Map<string, string>();
  if (halo != null) {
    for (const bin of bins) {
      if (!bin.hasArrow || bin.count === 0) continue;
      const hc = halo.color(bin);
      if (!haloMarkerByColor.has(hc)) {
        haloMarkerByColor.set(hc, `${arrowheadId}-halo-${colorIdSuffix(hc)}`);
      }
    }
  }

  // Removed `glyphColorScalar` — replaced by per-bin `glyphColorFor`.

  // Unique scope id per instance so multiple PassFlows on one page don't
  // cross-contaminate animation state. Derived from arrowheadId which is
  // already scope-stable.
  const scope = arrowheadId;
  const renderMorph = filterTransition === "morph";
  const renderAnimate = animate !== "none";
  const shouldEmitStyle = renderMorph || renderAnimate;

  return (
    <g
      data-campos="passflow-arrows"
      style={{ pointerEvents: "none" }}
      {...(renderAnimate
        ? { "data-campos-animate": animate, "data-campos-animate-scope": scope }
        : {})}
      {...(renderMorph ? { "data-campos-morph-scope": scope } : {})}
    >
      {shouldEmitStyle ? <style>{layerStyles(scope)}</style> : null}
      <defs>
        {Array.from(haloMarkerByColor).map(([c, id]) => (
          <marker
            key={id}
            id={id}
            markerWidth={arrowheadScale}
            markerHeight={arrowheadScale}
            refX={arrowheadScale - 1}
            refY={arrowheadScale / 2}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d={`M0,0 L${arrowheadScale},${arrowheadScale / 2} L0,${arrowheadScale} Z`}
              fill={c}
            />
          </marker>
        ))}
        {Array.from(markerByColor).map(([c, id]) => (
          <marker
            key={id}
            id={id}
            markerWidth={arrowheadScale}
            markerHeight={arrowheadScale}
            refX={arrowheadScale - 1}
            refY={arrowheadScale / 2}
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d={`M0,0 L${arrowheadScale},${arrowheadScale / 2} L0,${arrowheadScale} Z`}
              fill={c}
            />
          </marker>
        ))}
      </defs>

      {bins.map((bin) => {
        const cx = bin.x + bin.width / 2;
        const cy = bin.y + bin.height / 2;
        // Single source of truth for the bin id — the compute model now
        // emits `bin.key` in canonical `row-col` form, so the primitive
        // and the component read the same string.
        const keyBase = bin.key;

        // Arrow geometry (always computed; opacity toggles visibility when
        // morphing). If no mean angle, fall back to a degenerate line at
        // the bin centre so morphs to/from "no arrow" animate as a
        // shrink/grow rather than a snap to an arbitrary angle.
        let tailX = cx;
        let tailY = cy;
        let headX = cx;
        let headY = cy;
        if (bin.hasArrow && bin.meanAngle !== null) {
          const length =
            bin.magnitudeHint * arrowContainment * Math.min(bin.width, bin.height);
          const halfLen = length / 2;
          const cos = Math.cos(bin.meanAngle);
          const sin = Math.sin(bin.meanAngle);
          tailX = cx - halfLen * cos;
          tailY = cy - halfLen * sin;
          headX = cx + halfLen * cos;
          headY = cy + halfLen * sin;
        }
        const tail = project(tailX, tailY);
        const head = project(headX, headY);
        const arrowVisible = bin.hasArrow && bin.count > 0;
        const shouldRenderArrow = arrowVisible || renderMorph;
        // Only invoke the `arrowColor` callback on bins that will draw a
        // visible arrow. Empty / morph-invisible bins use the scalar
        // fallback so callbacks don't see NaN-prone degenerate inputs.
        const lineResolvedColor = arrowVisible ? colorFor(bin) : fallbackColor;
        const markerId = markerByColor.get(lineResolvedColor) ?? fallbackMarkerId;

        // Glyph geometry (always computed for similar reason).
        const radius = GLYPH_RADIUS_FRAC * Math.min(bin.width, bin.height);
        const center = project(cx, cy);
        const glyphOffset = project(cx + radius, cy);
        const pxGlyphRadius = Math.max(
          1,
          Math.hypot(glyphOffset.x - center.x, glyphOffset.y - center.y),
        );
        const glyphVisible =
          bin.lowDispersion && bin.count > 0 && lowDispersionGlyph !== "none";
        const shouldRenderGlyph =
          lowDispersionGlyph !== "none" && (glyphVisible || renderMorph);

        const baseStroke = strokeFor(bin);
        const haloVisible = halo != null && arrowVisible;
        const haloStroke = halo != null && arrowVisible ? baseStroke * halo.width : 0;
        const haloColor = halo != null && arrowVisible ? halo.color(bin) : undefined;
        const haloMarkerId =
          haloVisible && haloColor != null ? haloMarkerByColor.get(haloColor) : undefined;

        return (
          <g key={keyBase}>
            {haloVisible ? (
              <line
                key={`halo:${keyBase}`}
                x1={roundSvg(tail.x)}
                y1={roundSvg(tail.y)}
                x2={roundSvg(head.x)}
                y2={roundSvg(head.y)}
                stroke={haloColor}
                strokeWidth={haloStroke}
                strokeLinecap="round"
                markerEnd={haloMarkerId != null ? `url(#${haloMarkerId})` : undefined}
                opacity={1}
              />
            ) : null}
            {shouldRenderArrow ? (
              <line
                key={`arrow:${keyBase}`}
                x1={roundSvg(tail.x)}
                y1={roundSvg(tail.y)}
                x2={roundSvg(head.x)}
                y2={roundSvg(head.y)}
                stroke={lineResolvedColor}
                strokeWidth={baseStroke}
                strokeLinecap="round"
                markerEnd={arrowVisible ? `url(#${markerId})` : undefined}
                data-bin-col={bin.col}
                data-bin-row={bin.row}
                data-active={bin.key === activeBinKey ? "1" : "0"}
                opacity={arrowVisible ? 1 : 0}
              />
            ) : null}
            {shouldRenderGlyph && lowDispersionGlyph === "circle" ? (
              <circle
                key={`glyph:${keyBase}`}
                cx={roundSvg(center.x)}
                cy={roundSvg(center.y)}
                r={roundSvg(pxGlyphRadius)}
                fill="none"
                stroke={glyphColorFor(bin)}
                strokeWidth={strokeFor(bin) * 0.8}
                opacity={glyphVisible ? 0.7 : 0}
                data-bin-col={bin.col}
                data-bin-row={bin.row}
              />
            ) : null}
            {shouldRenderGlyph && lowDispersionGlyph === "cross"
              ? (() => {
                  const halfArm = pxGlyphRadius;
                  const cxR = roundSvg(center.x);
                  const cyR = roundSvg(center.y);
                  const leftR = roundSvg(center.x - halfArm);
                  const rightR = roundSvg(center.x + halfArm);
                  const topR = roundSvg(center.y - halfArm);
                  const bottomR = roundSvg(center.y + halfArm);
                  return (
                    <g
                      key={`glyph:${keyBase}`}
                      data-bin-col={bin.col}
                      data-bin-row={bin.row}
                      opacity={glyphVisible ? 0.7 : 0}
                    >
                      <line
                        x1={leftR}
                        y1={cyR}
                        x2={rightR}
                        y2={cyR}
                        stroke={glyphColorFor(bin)}
                        strokeWidth={strokeFor(bin) * 0.8}
                        strokeLinecap="round"
                      />
                      <line
                        x1={cxR}
                        y1={topR}
                        x2={cxR}
                        y2={bottomR}
                        stroke={glyphColorFor(bin)}
                        strokeWidth={strokeFor(bin) * 0.8}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })()
              : null}
          </g>
        );
      })}
    </g>
  );
}
