import { PITCH } from "./geometry/constants.js";
import {
  CHANNEL_EDGE_HIGH,
  CHANNEL_EDGE_LOW,
  THIRD_EDGE_HIGH,
  THIRD_EDGE_LOW,
} from "./geometry/camposZones.js";
import type { ZoneLayout } from "./react/TacticalMarkings.js";

/**
 * Stadia zone layouts expressed as bin edges in Campos canonical 0–100
 * space (attacker-relative, `x: 0 = own goal → 100 = opposition goal`,
 * `y: 0 = attacker's right`).
 *
 * Use these with `<PassFlow xEdges={…} yEdges={…} />` or
 * `<Heatmap xEdges={…} yEdges={…} />` to bin data into tactical zones
 * rather than an arbitrary uniform grid.
 *
 * **Full-pitch only.** Both layouts span `x: 0..100`, so they are
 * incompatible with `crop="half"` (which expects `xEdges[0] === 50`). The
 * chart will throw `InvalidEdgesError` if the two are combined; bin a
 * full pitch and let the renderer's `attackingDirection` handle visual
 * orientation instead.
 *
 * Row/column positions are converted from pitch metres (105 × 68) into
 * Campos 0–100 units by linear scaling. The mapping is orientation-invariant
 * because Campos space is
 * attacker-relative; renderers decide the screen orientation via their
 * own `attackingDirection` / `orientation` prop, not via the edges.
 *
 * Drawing the tactical markings underneath the bins is separate — the
 * cells align with the grid mathematically but the visible zone lines
 * are a `<Pitch>` concern. See the example on `zoneEdgesInCampos`.
 */
export type ZoneEdges = {
  /** x-axis (along pitch length) edges, inclusive of 0 and 100. */
  xEdges: readonly number[];
  /** y-axis (across pitch width) edges, inclusive of 0 and 100. */
  yEdges: readonly number[];
};

/** Scale a pitch-metre value on the length axis to Campos x. */
function toCamposX(lengthMetres: number): number {
  return (lengthMetres / PITCH.length) * 100;
}

/** Scale a pitch-metre value on the width axis to Campos y. */
function toCamposY(widthMetres: number): number {
  return (widthMetres / PITCH.width) * 100;
}

// ── 18-zone: 6 rows × 3 columns (equal divisions) ────────────────────────
// Rows span the pitch length; columns span the pitch width. The inner
// x-edges at 1/3 and 2/3 are the `THIRD_EDGE_*` constants and the
// y-edges are the `CHANNEL_EDGE_*` constants — sharing them with
// `zones-predicates` keeps the two modules aligned.
const ZONE_18_X_EDGES: readonly number[] = Object.freeze([
  0,
  toCamposX(PITCH.length / 6),
  THIRD_EDGE_LOW,
  toCamposX(PITCH.length / 2),
  THIRD_EDGE_HIGH,
  toCamposX((5 * PITCH.length) / 6),
  100,
]);
const ZONE_18_Y_EDGES: readonly number[] = Object.freeze([
  0,
  CHANNEL_EDGE_LOW,
  CHANNEL_EDGE_HIGH,
  100,
]);

// ── 20-zone: 4 rows × 5 positional columns ───────────────────────────────
// Rows: quarter divisions along length.
// Cols: wide | half-space | centre | half-space | wide, aligned to
// penalty-area edges, with the PA interior split into equal thirds.
const hsLeft = (PITCH.width - PITCH.penaltyAreaWidth) / 2;
const hsRight = PITCH.width - hsLeft;
const paInnerThird = PITCH.penaltyAreaWidth / 3;

const ZONE_20_X_EDGES: readonly number[] = Object.freeze([
  0,
  ...Array.from({ length: 3 }, (_, i) => toCamposX(((i + 1) * PITCH.length) / 4)),
  100,
]);
const ZONE_20_Y_EDGES: readonly number[] = Object.freeze([
  0,
  toCamposY(hsLeft),
  toCamposY(hsLeft + paInnerThird),
  toCamposY(hsRight - paInnerThird),
  toCamposY(hsRight),
  100,
]);

/**
 * Return tactical-zone bin edges in Campos 0–100 space for a named layout.
 *
 * Returned arrays are module-level singletons and frozen — stable
 * reference-identity across calls means consumers can memoise on them
 * without triggering churn on each render.
 *
 * @example
 * ```tsx
 * import { PassFlow } from "@withqwerty/campos-react";
 * import { zoneEdgesInCampos } from "@withqwerty/campos-stadia";
 *
 * const edges = zoneEdgesInCampos("20");
 * return (
 *   <PassFlow passes={passes} xEdges={edges.xEdges} yEdges={edges.yEdges} />
 * );
 * ```
 *
 * To draw the zone markings visually underneath the bins, render a
 * `<Pitch zones="20">` beside the chart (or use the `showPitchZones`
 * prop once it lands). Passing a `<PassFlow>` as a child of a
 * `<Pitch zones="…">` does NOT inherit the zone markings — the chart
 * renders its own internal Pitch.
 */
export function zoneEdgesInCampos(layout: ZoneLayout): ZoneEdges {
  if (layout === "18") {
    return { xEdges: ZONE_18_X_EDGES, yEdges: ZONE_18_Y_EDGES };
  }
  return { xEdges: ZONE_20_X_EDGES, yEdges: ZONE_20_Y_EDGES };
}
