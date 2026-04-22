import { max as d3Max } from "d3-array";

import { interpolateStops, type ColorStop } from "./color.js";
import { resolveColorStops } from "./color-scales.js";
import { assignBin, uniformEdges, validateEdges } from "./edges.js";
import { clamp } from "./math.js";

export { InvalidEdgesError } from "./edges.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeatmapEvent = {
  x: number;
  y: number;
  [key: string]: unknown;
};

export type HeatmapCell = {
  row: number;
  col: number;
  /** Left edge in Campos 0-100 x-coordinates. */
  x: number;
  /** Bottom edge in Campos 0-100 y-coordinates. */
  y: number;
  /** Cell width in Campos coordinate units. */
  width: number;
  /** Cell height in Campos coordinate units. */
  height: number;
  /** Raw event count in this cell. */
  count: number;
  /** 0-1 intensity value (count / maxCount), 0 when empty. Drives the color ramp. */
  intensity: number;
  /**
   * 0-1 share of the cropped-valid total (count / totalCount), 0 when empty.
   * Denominator is the same set of events used for binning — if `crop="half"`,
   * events outside the attacking half are excluded from the denominator.
   */
  share: number;
  /** CSS fill color derived from the sequential color scale. */
  fill: string;
  /** CSS opacity — 0 for empty cells, 1 for non-empty. */
  opacity: number;
};

export type HeatmapColorScale =
  | "magma"
  | "viridis"
  | "inferno"
  | "blues"
  | "greens"
  | "custom";

/**
 * How scale-bar domain and tooltip values are expressed.
 * The color ramp is invariant across modes (always uses `intensity`).
 * - `count` — raw counts
 * - `intensity` — count / maxCount, rendered as 0–100%
 * - `share` — count / totalCount, rendered as 0–maxShare%
 */
export type HeatmapValueMode = "count" | "intensity" | "share";

export type HeatmapModel = {
  meta: {
    component: "Heatmap";
    empty: boolean;
    attackingDirection: "up" | "down" | "left" | "right";
    crop: "full" | "half";
    valueMode: HeatmapValueMode;
    warnings: string[];
  };
  grid: {
    columns: number;
    rows: number;
    cells: HeatmapCell[];
  };
  scaleBar: {
    label: string;
    domain: [number, number];
    stops: ColorStop[];
    valueMode: HeatmapValueMode;
  } | null;
  pitch: {
    crop: "full" | "half";
    attackingDirection: "up" | "down" | "left" | "right";
  };
  emptyState: {
    message: string;
  } | null;
};

export type ComputeHeatmapInput = {
  events: readonly HeatmapEvent[];
  /** Number of columns (x-axis bins). @default 12 */
  gridX?: number;
  /** Number of rows (y-axis bins). @default 8 */
  gridY?: number;
  /**
   * Explicit x-axis bin edges in Campos 0–100 space. When supplied,
   * overrides `gridX`. Must be strictly monotonic increasing; first edge
   * must equal the crop left boundary, last edge must equal `100`.
   * Use `zoneEdgesInCampos()` from `@withqwerty/campos-stadia` to bin
   * into tactical zones.
   */
  xEdges?: readonly number[];
  /**
   * Explicit y-axis bin edges in Campos 0–100 space. When supplied,
   * overrides `gridY`. Must be strictly monotonic increasing from `0`
   * to `100`.
   */
  yEdges?: readonly number[];
  /** Sequential color scale. @default "magma" */
  colorScale?: HeatmapColorScale;
  /** Custom color stops when colorScale is "custom". Falls back to magma. */
  colorStops?: ColorStop[];
  /** Direction attacker is facing. @default "right" */
  attackingDirection?: "up" | "down" | "left" | "right";
  /** Pitch crop. @default "full" */
  crop?: "full" | "half";
  /** Label for the scale bar — describes what each count measures. @default "Events" */
  metricLabel?: string;
  /**
   * How scale-bar domain and tooltip values are expressed.
   * The color ramp is invariant across modes — only labels and domain change.
   * @default "count"
   */
  valueMode?: HeatmapValueMode;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEvent(event: HeatmapEvent): boolean {
  // Runtime guard: callers may pass null/undefined despite the type signature.
  const x = event.x as number | null | undefined;
  const y = event.y as number | null | undefined;
  return x != null && y != null && Number.isFinite(x) && Number.isFinite(y);
}

function normalizeGridSize(
  value: number | undefined,
  fallback: number,
  label: "gridX" | "gridY",
): { value: number; warning: string | null } {
  if (value == null) {
    return { value: fallback, warning: null };
  }
  if (!Number.isFinite(value)) {
    return {
      value: fallback,
      warning: `${label} was non-finite and fell back to ${fallback}.`,
    };
  }

  const rounded = Math.round(value);
  const normalized = Math.max(1, rounded);
  if (normalized !== value) {
    return {
      value: normalized,
      warning: `${label} was adjusted to ${normalized}.`,
    };
  }

  return { value: normalized, warning: null };
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a Campos Heatmap.
 *
 * Bins events into a uniform rectangular grid over the 0-100 Campos
 * coordinate space and returns cell counts with a sequential color scale.
 */
export function computeHeatmap(input: ComputeHeatmapInput): HeatmapModel {
  const attackingDirection = input.attackingDirection ?? "right";
  const crop = input.crop ?? "full";
  const metricLabel = input.metricLabel ?? "Events";
  const valueMode: HeatmapValueMode = input.valueMode ?? "count";
  const stops = resolveColorStops(input.colorScale, input.colorStops);
  const cropMinX = crop === "half" ? 50 : 0;
  const cropMaxX = 100;
  const cropMinY = 0;
  const cropMaxY = 100;

  // Resolve edges: explicit `xEdges`/`yEdges` win; else fall back to the
  // uniform `gridX`/`gridY` grid. Validation mirrors PassFlow so
  // `zoneEdgesInCampos()` results drop straight into either chart.
  const warnings: string[] = [];
  let xEdges: number[];
  let yEdges: number[];
  if (input.xEdges != null) {
    if (input.gridX != null) {
      warnings.push("Both xEdges and gridX supplied — xEdges wins; gridX is ignored.");
    }
    validateEdges(input.xEdges, cropMinX, cropMaxX, "x");
    xEdges = input.xEdges.slice();
  } else {
    const gridXResult = normalizeGridSize(input.gridX, 12, "gridX");
    if (gridXResult.warning) warnings.push(gridXResult.warning);
    xEdges = uniformEdges(gridXResult.value, cropMinX, cropMaxX);
  }
  if (input.yEdges != null) {
    if (input.gridY != null) {
      warnings.push("Both yEdges and gridY supplied — yEdges wins; gridY is ignored.");
    }
    validateEdges(input.yEdges, cropMinY, cropMaxY, "y");
    yEdges = input.yEdges.slice();
  } else {
    const gridYResult = normalizeGridSize(input.gridY, 8, "gridY");
    if (gridYResult.warning) warnings.push(gridYResult.warning);
    yEdges = uniformEdges(gridYResult.value, cropMinY, cropMaxY);
  }
  const gridX = xEdges.length - 1;
  const gridY = yEdges.length - 1;

  const validEvents = input.events.filter(isValidEvent);
  const croppedEvents = validEvents
    .map((event) => ({
      ...event,
      x: clamp(event.x, 0, 100),
      y: clamp(event.y, 0, 100),
    }))
    .filter((event) => event.x >= cropMinX && event.x <= cropMaxX);
  const excludedCount = input.events.length - validEvents.length;

  if (excludedCount > 0) {
    warnings.push(
      `${excludedCount} event${excludedCount === 1 ? "" : "s"} excluded due to non-finite coordinates.`,
    );
  }
  if (croppedEvents.length > 0 && croppedEvents.length < 3) {
    warnings.push("Heatmap may not be meaningful with fewer than 3 valid events.");
  }

  /** Shared cell-geometry builder — used by both empty and populated paths. */
  const buildCellGeometry = (row: number, col: number) => {
    const x = xEdges[col]!;
    const y = yEdges[row]!;
    return {
      x,
      y,
      width: xEdges[col + 1]! - x,
      height: yEdges[row + 1]! - y,
    };
  };

  if (croppedEvents.length === 0) {
    const cells: HeatmapCell[] = [];
    for (let row = 0; row < gridY; row += 1) {
      for (let col = 0; col < gridX; col += 1) {
        const geo = buildCellGeometry(row, col);
        cells.push({
          row,
          col,
          ...geo,
          count: 0,
          intensity: 0,
          share: 0,
          fill: "rgba(0,0,0,0)",
          opacity: 0,
        });
      }
    }

    return {
      meta: {
        component: "Heatmap",
        empty: true,
        attackingDirection,
        crop,
        valueMode,
        warnings,
      },
      grid: { columns: gridX, rows: gridY, cells },
      scaleBar: null,
      pitch: { crop, attackingDirection },
      emptyState: { message: "No event data" },
    };
  }

  // Bin events via shared edge-driven assignment.
  const counts = new Array<number>(gridX * gridY).fill(0);
  for (const event of croppedEvents) {
    const col = assignBin(event.x, xEdges);
    const row = assignBin(event.y, yEdges);
    if (col < 0 || row < 0) continue;
    const idx = row * gridX + col;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }

  const maxCount = d3Max(counts) ?? 0;
  // Denominator for share is the cropped total, not the full event set.
  const totalCount = croppedEvents.length;

  const cells: HeatmapCell[] = [];
  for (let row = 0; row < gridY; row += 1) {
    for (let col = 0; col < gridX; col += 1) {
      const count = counts[row * gridX + col] ?? 0;
      const intensity = maxCount > 0 ? count / maxCount : 0;
      const share = totalCount > 0 ? count / totalCount : 0;
      const isEmpty = count === 0;
      const geo = buildCellGeometry(row, col);

      cells.push({
        row,
        col,
        ...geo,
        count,
        intensity,
        share,
        fill: isEmpty ? "rgba(0,0,0,0)" : interpolateStops(stops, intensity),
        opacity: isEmpty ? 0 : 1,
      });
    }
  }

  return {
    meta: {
      component: "Heatmap",
      empty: false,
      attackingDirection,
      crop,
      valueMode,
      warnings,
    },
    grid: { columns: gridX, rows: gridY, cells },
    scaleBar: {
      label: metricLabel,
      domain: scaleBarDomain(valueMode, maxCount, totalCount),
      stops,
      valueMode,
    },
    pitch: { crop, attackingDirection },
    emptyState: null,
  };
}

/**
 * Compute the scale-bar numeric domain for the active value mode.
 * - `count`: [0, maxCount] — raw counts, integer-ish domain
 * - `intensity`: [0, 1] — 0-100% of the peak cell
 * - `share`: [0, maxShare] — max cell's share of the total
 */
function scaleBarDomain(
  valueMode: HeatmapValueMode,
  maxCount: number,
  totalCount: number,
): [number, number] {
  switch (valueMode) {
    case "count":
      return [0, maxCount];
    case "intensity":
      return [0, 1];
    case "share":
      return [0, totalCount > 0 ? maxCount / totalCount : 0];
  }
}
