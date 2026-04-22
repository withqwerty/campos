import { sum as d3Sum } from "d3-array";

import {
  resolvePitchZonePresetEdges,
  zonePresetGridOverrideWarning,
  type PitchZonePreset,
  type UniformPitchZonePreset,
} from "./pitch-zone-presets.js";
import { interpolateStops, type ColorStop } from "./color.js";
import { computeHeatmap, type HeatmapColorScale } from "./heatmap.js";
import { resolveColorStops } from "./color-scales.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Territory grid resolution.
 *
 * - `"3x3"` — 3 thirds along the attacking axis × 3 channels (left/center/right) = 9 cells.
 * - `"5x3"` — 5 vertical zones along the attacking axis × 3 channels = 15 cells.
 *
 * The 3-channels-per-row layout is fixed in v0.3. Non-uniform Juego de Posición
 * positional zones (mplsoccer's `bin_statistic_positional`) are deferred to a
 * future `PositionalZones` variant.
 */
/**
 * Uniform editorial territory grids only.
 *
 * `TerritoryGrid` intentionally excludes tactical 18 / 20 zone layouts; those
 * now live under `TerritoryZonePreset` and the renderer-level `zonePreset` prop.
 */
export type TerritoryGrid = UniformPitchZonePreset;
export type TerritoryZonePreset = PitchZonePreset;

export type TerritoryEvent = {
  x: number | null;
  y: number | null;
  team?: string;
  [key: string]: unknown;
};

export type TerritoryCell = {
  /** 0-based row index — channel (0=left, 1=center, 2=right). */
  row: number;
  /** 0-based column index — third (3x3) or zone (5x3) along the attacking axis. */
  col: number;
  /** Left edge in Campos 0-100 x-coordinates. */
  x: number;
  /** Bottom edge in Campos 0-100 y-coordinates. */
  y: number;
  /** Cell width in Campos coordinate units. */
  width: number;
  /** Cell height in Campos coordinate units. */
  height: number;
  /** Center x in Campos coordinates — for label positioning. */
  centerX: number;
  /** Center y in Campos coordinates — for label positioning. */
  centerY: number;
  /** Raw event count in this cell after filtering. */
  count: number;
  /**
   * Cell share of the cropped, filtered total (count / totalEvents).
   * Drives both the color ramp and the percentage label. 0 when empty.
   */
  share: number;
  /** CSS fill color from the sequential color scale, transparent for empty. */
  fill: string;
  /** CSS opacity — 0 for empty cells, 1 for non-empty. */
  opacity: number;
  /**
   * Pre-computed integer-percent label string (e.g. "18%"). Null when the
   * cell is empty OR when the user disabled labels via `showLabels: false`.
   * The model carries the label so renderers can choose whether to show it.
   */
  label: string | null;
};

export type TerritoryModel = {
  meta: {
    component: "Territory";
    empty: boolean;
    attackingDirection: "up" | "down" | "left" | "right";
    crop: "full" | "half";
    grid: TerritoryZonePreset;
    /** Total valid events that contributed to the binning (post-filter, post-crop). */
    totalEvents: number;
    /** Noun describing what each event measures (e.g. "touches"). */
    metricLabel: string;
    warnings: string[];
  };
  grid: {
    columns: number;
    rows: number;
    cells: TerritoryCell[];
  };
  pitch: {
    crop: "full" | "half";
    attackingDirection: "up" | "down" | "left" | "right";
  };
  emptyState: { message: string } | null;
};

export type ComputeTerritoryInput = {
  events: readonly TerritoryEvent[];
  /** Grid resolution. @default "3x3" */
  grid?: TerritoryGrid;
  /**
   * Shared named pitch-zone preset. Overrides `grid` when supplied.
   */
  zonePreset?: TerritoryZonePreset;
  /** Direction attacker is facing. @default "up" */
  attackingDirection?: "up" | "down" | "left" | "right";
  /** Pitch crop. @default "full" */
  crop?: "full" | "half";
  /** Show in-cell percentage labels in the model. @default true */
  showLabels?: boolean;
  /**
   * Optional case-sensitive equality match against `event.team`. Events whose
   * `team` field does not equal this string are excluded before binning.
   * Use this for the broadcast "show one team's territory" use case.
   */
  teamFilter?: string;
  /** Sequential color scale. @default "magma" */
  colorScale?: HeatmapColorScale;
  /** Custom color stops when colorScale is "custom". Falls back to magma. */
  colorStops?: ColorStop[];
  /** Noun used in meta for accessible labels and renderer chrome. @default "events" */
  metricLabel?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for a Campos Territory chart.
 *
 * Wraps `computeHeatmap` with a fixed 3×3 or 5×3 grid (always 3 rows / channels;
 * the column axis depends on `grid`). Cell color is driven by `share` (cell
 * count divided by the total binned events) so that territory diagrams remain
 * comparable across matches with very different event totals.
 *
 * Row 0 is the bottom-touchline channel; col 0 is the defensive third / first
 * vertical zone. The "attacking axis" is x; the channel axis is y.
 *
 * The compute is pure: no DOM, no React, no orientation transforms. The
 * `orientation` field is recorded in `meta` and `pitch` for the renderer to
 * project — cell coordinates remain in the canonical Campos 0-100 space.
 */
export function computeTerritory(input: ComputeTerritoryInput): TerritoryModel {
  const attackingDirection = input.attackingDirection ?? "up";
  const crop = input.crop ?? "full";
  const showLabels = input.showLabels ?? true;
  const metricLabel = input.metricLabel ?? "events";
  const stops = resolveColorStops(input.colorScale, input.colorStops);
  const requestedZonePreset = input.zonePreset;
  const fallbackGrid = input.grid ?? "3x3";
  const zoneResolution =
    requestedZonePreset != null
      ? resolvePitchZonePresetEdges(requestedZonePreset, crop)
      : null;
  const fallbackEdges = resolvePitchZonePresetEdges(fallbackGrid, crop);
  if (fallbackEdges.xEdges == null) {
    throw new Error("Uniform Territory grids must resolve to concrete pitch-zone edges.");
  }
  const resolvedGrid: TerritoryZonePreset =
    zoneResolution?.xEdges != null ? (requestedZonePreset ?? fallbackGrid) : fallbackGrid;
  const resolvedEdges = zoneResolution?.xEdges != null ? zoneResolution : fallbackEdges;
  const { xEdges, yEdges, columns, rows } = resolvedEdges;

  // Pre-filter by team if requested. The team filter runs BEFORE binning so
  // that excluded events do not affect the share denominator (broadcast intent:
  // "show only this team's share of zones").
  const filteredEvents =
    input.teamFilter != null
      ? input.events.filter((event) => event.team === input.teamFilter)
      : input.events;

  const teamFilterWarning =
    input.teamFilter != null && filteredEvents.length === 0 && input.events.length > 0
      ? `teamFilter "${input.teamFilter}" matched 0 of ${input.events.length} events.`
      : null;

  // Delegate the binning math to `computeHeatmap`: it handles clamping,
  // non-finite exclusion, crop, and warnings. The cell list returned has the
  // correct rectangular geometry; we then post-process counts into `share`
  // and synthesize cell centers + label strings.
  //
  // Heatmap's `orientation` is a renderer hint that does not affect cell
  // geometry — cell coordinates are always canonical 0-100. We pin it to
  // "horizontal" so Territory's own orientation choice flows only through
  // the React renderer / `meta` and doesn't double-transform anything.
  const heatmap = computeHeatmap({
    events: filteredEvents.map((event) => ({
      x: event.x as number,
      y: event.y as number,
    })),
    xEdges,
    yEdges,
    attackingDirection: "right",
    crop,
    metricLabel,
    valueMode: "count",
    ...(input.colorScale != null ? { colorScale: input.colorScale } : {}),
    ...(input.colorStops != null ? { colorStops: input.colorStops } : {}),
  });

  const totalEvents = d3Sum(heatmap.grid.cells, (c) => c.count);
  const warnings = [...(zoneResolution?.warnings ?? []), ...heatmap.meta.warnings];
  if (
    requestedZonePreset != null &&
    input.grid != null &&
    zoneResolution?.xEdges != null
  ) {
    warnings.push(zonePresetGridOverrideWarning("grid"));
  }
  if (teamFilterWarning != null) {
    warnings.push(teamFilterWarning);
  }

  const cells: TerritoryCell[] = heatmap.grid.cells.map((cell) => {
    const share = totalEvents > 0 ? cell.count / totalEvents : 0;
    const isEmpty = cell.count === 0;
    const fill = isEmpty ? "rgba(0,0,0,0)" : interpolateStops(stops, share);
    const label = !isEmpty && showLabels ? formatPercent(share) : null;
    return {
      row: cell.row,
      col: cell.col,
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
      centerX: cell.x + cell.width / 2,
      centerY: cell.y + cell.height / 2,
      count: cell.count,
      share,
      fill,
      opacity: isEmpty ? 0 : 1,
      label,
    };
  });

  const empty = totalEvents === 0;

  return {
    meta: {
      component: "Territory",
      empty,
      attackingDirection,
      crop,
      grid: resolvedGrid,
      totalEvents,
      metricLabel,
      warnings,
    },
    grid: {
      columns,
      rows,
      cells,
    },
    pitch: {
      crop,
      attackingDirection,
    },
    emptyState: empty ? { message: "No event data" } : null,
  };
}
