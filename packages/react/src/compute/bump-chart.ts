import { extent as d3Extent } from "d3-array";

import {
  applyAxisPadding,
  type AxisPaddingInput,
  DEFAULT_AXIS_PADDING,
  resolveAxisPadding,
} from "./scales/axis-padding.js";
import { createLinearScale } from "./scales/linear-scale.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BumpChartRow = {
  /** Team or entity identifier. */
  team: string;
  /** Timepoint index (matchweek, round, etc.). */
  timepoint: number;
  /** Rank position (1 = best). */
  rank: number;
  /** Display label for the team (defaults to `team`). */
  label?: string;
  /** Underlying numeric value (e.g. points) for tooltip enrichment. */
  value?: number;
  /** Custom formatted tooltip text. */
  displayValue?: string;
};

export type BumpChartPointModel = {
  /** Timepoint index. */
  timepoint: number;
  /** Rank at this timepoint. */
  rank: number;
  /** SVG x-coordinate. */
  cx: number;
  /** SVG y-coordinate. */
  cy: number;
  /** Optional underlying value. */
  value: number | null;
  /** Display text for tooltip. */
  displayValue: string;
};

export type BumpChartLineModel = {
  /** Team identifier. */
  team: string;
  /** Display label. */
  teamLabel: string;
  /** Line color (hex). */
  color: string;
  /** Whether this team is highlighted (full opacity). */
  highlighted: boolean;
  /** Pre-computed SVG path string (smooth or linear). */
  path: string;
  /** Ordered data points for hit-testing / tooltips. */
  points: BumpChartPointModel[];
  /** Rank at the final timepoint. */
  finalRank: number;
  /** Rank at the first timepoint. */
  startRank: number;
};

export type BumpChartEndLabelModel = {
  team: string;
  teamLabel: string;
  /** SVG x-coordinate (right edge). */
  x: number;
  /** SVG y-coordinate (adjusted for overlap avoidance). */
  y: number;
  color: string;
  rank: number;
};

export type BumpChartStartLabelModel = {
  team: string;
  teamLabel: string;
  /** SVG x-coordinate (left edge). */
  x: number;
  /** SVG y-coordinate (adjusted for overlap avoidance). */
  y: number;
  color: string;
  rank: number;
};

export type BumpChartAxisModel = {
  x: {
    label: string;
    domain: [number, number];
    ticks: number[];
  };
  y: {
    label: string;
    domain: [number, number];
    ticks: number[];
  };
};

export type BumpChartModel = {
  meta: {
    component: "BumpChart";
    empty: boolean;
    totalRows: number;
    validRows: number;
    totalTeams: number;
    highlightedTeams: number;
    warnings: string[];
    accessibleLabel: string;
  };
  layout: {
    viewBox: { width: number; height: number };
    plotArea: { x: number; y: number; width: number; height: number };
    frame: { x: number; y: number; width: number; height: number };
  };
  axes: BumpChartAxisModel;
  lines: BumpChartLineModel[];
  endLabels: BumpChartEndLabelModel[];
  startLabels: BumpChartStartLabelModel[];
  emptyState: { message: string } | null;
};

export type ComputeBumpChartInput = {
  rows: readonly BumpChartRow[];
  highlightTeams?: readonly string[];
  interpolation?: "smooth" | "linear";
  showMarkers?: boolean;
  showEndLabels?: boolean;
  showStartLabels?: boolean;
  showGridLines?: boolean;
  rankDomain?: readonly [number, number];
  teamColors?: Readonly<Record<string, string>>;
  timepointLabel?: string;
  rankLabel?: string;
  markerRadius?: number;
  backgroundOpacity?: number;
  /**
   * Emit end labels for every team even when `highlightTeams` is set. Default
   * false — only highlighted teams get end labels, matching the "story bump"
   * pattern. Set true for full-league bump charts where every line should
   * remain identifiable.
   */
  endLabelsForAllTeams?: boolean;
  /** Same as `endLabelsForAllTeams` but for start labels. Default false. */
  startLabelsForAllTeams?: boolean;
  /** Pixel gutter between plot rect and axis lines. Default 6. */
  axisPadding?: AxisPaddingInput;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX_W = 640;
const VIEWBOX_H = 380;
const MARGIN = { top: 16, right: 100, bottom: 36, left: 44 };
const PLOT_W = VIEWBOX_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEWBOX_H - MARGIN.top - MARGIN.bottom;

/** Maximum highlighted teams before visual clutter. */
const MAX_HIGHLIGHT = 7;

/** Minimum pixel gap between end labels to avoid overlap. */
const END_LABEL_MIN_GAP = 12;

/** Catmull-Rom tension parameter (0.5 = centripetal). */
const CR_ALPHA = 0.5;

/** Default color palette — 12 maximally distinct colors. */
const DEFAULT_PALETTE = [
  "#c8102e", // red
  "#6cabdd", // sky blue
  "#fdb913", // yellow
  "#132257", // navy
  "#ee2737", // bright red
  "#003090", // royal blue
  "#7a263a", // claret
  "#00a650", // green
  "#241f20", // black
  "#d71920", // crimson
  "#fbee23", // gold
  "#0057b8", // blue
] as const;

/** Color for non-highlighted (background) teams. */
const BACKGROUND_COLOR = "#888888";

/** Maximum x-axis ticks before thinning. */
const MAX_X_TICKS = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places for SVG readability. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Check if a row has valid data. */
function isValidRow(row: BumpChartRow): boolean {
  return (
    typeof row.team === "string" &&
    row.team.length > 0 &&
    typeof row.timepoint === "number" &&
    Number.isFinite(row.timepoint) &&
    typeof row.rank === "number" &&
    Number.isFinite(row.rank) &&
    row.rank >= 1
  );
}

/**
 * Truncate text to maxLen graphemes with ellipsis. Uses `Array.from` so that
 * surrogate pairs (emoji flags, astral-plane glyphs) survive the slice — the
 * naive `text.slice` would tear them at the UTF-16 code-unit boundary.
 */
function truncate(text: string, maxLen: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  return chars.slice(0, maxLen - 1).join("") + "\u2026";
}

// ---------------------------------------------------------------------------
// Catmull-Rom interpolation
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };

/**
 * Compute the knot interval for centripetal Catmull-Rom.
 * Uses |P1 - P0|^alpha where alpha = 0.5 (centripetal).
 */
function knotInterval(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.pow(dist, CR_ALPHA);
}

/**
 * Convert a Catmull-Rom segment (4 control points) to cubic Bezier control points.
 * Returns [cp1, cp2] — the two inner control points of the cubic Bezier from P1 to P2.
 */
function catmullRomToBezier(p0: Point, p1: Point, p2: Point, p3: Point): [Point, Point] {
  const d1 = knotInterval(p0, p1);
  const d2 = knotInterval(p1, p2);
  const d3 = knotInterval(p2, p3);

  // Guard against zero-length segments
  const safeD1 = d1 < 1e-6 ? 1 : d1;
  const safeD2 = d2 < 1e-6 ? 1 : d2;
  const safeD3 = d3 < 1e-6 ? 1 : d3;

  // Tangent at P1
  const m1x =
    safeD2 *
    ((p1.x - p0.x) / safeD1 - (p2.x - p0.x) / (safeD1 + safeD2) + (p2.x - p1.x) / safeD2);
  const m1y =
    safeD2 *
    ((p1.y - p0.y) / safeD1 - (p2.y - p0.y) / (safeD1 + safeD2) + (p2.y - p1.y) / safeD2);

  // Tangent at P2
  const m2x =
    safeD2 *
    ((p2.x - p1.x) / safeD2 - (p3.x - p1.x) / (safeD2 + safeD3) + (p3.x - p2.x) / safeD3);
  const m2y =
    safeD2 *
    ((p2.y - p1.y) / safeD2 - (p3.y - p1.y) / (safeD2 + safeD3) + (p3.y - p2.y) / safeD3);

  // Bezier control points
  const cp1: Point = { x: p1.x + m1x / 3, y: p1.y + m1y / 3 };
  const cp2: Point = { x: p2.x - m2x / 3, y: p2.y - m2y / 3 };

  return [cp1, cp2];
}

/**
 * Build an SVG path string using Catmull-Rom interpolation through the given points.
 * Control-point y-values are clamped to [yMin, yMax] to prevent rank overshoot.
 */
function buildSmoothPath(points: Point[], yMin: number, yMax: number): string {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  if (points.length === 1) return `M ${round(first.x)} ${round(first.y)}`;

  const n = points.length;
  const last = points[n - 1] as Point;
  const parts: string[] = [`M ${round(first.x)} ${round(first.y)}`];

  for (let i = 0; i < n - 1; i++) {
    // Use reflection for boundary points
    const p0 = i === 0 ? first : (points[i - 1] as Point);
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p3 = i === n - 2 ? last : (points[i + 2] as Point);

    const [cp1, cp2] = catmullRomToBezier(p0, p1, p2, p3);

    // Clamp control point y-values to rank bounds
    const clampedCp1y = Math.max(yMin, Math.min(yMax, cp1.y));
    const clampedCp2y = Math.max(yMin, Math.min(yMax, cp2.y));

    parts.push(
      `C ${round(cp1.x)} ${round(clampedCp1y)} ${round(cp2.x)} ${round(clampedCp2y)} ${round(p2.x)} ${round(p2.y)}`,
    );
  }

  return parts.join(" ");
}

/** Build a simple linear SVG path. */
function buildLinearPath(points: Point[]): string {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  const parts: string[] = [`M ${round(first.x)} ${round(first.y)}`];
  for (const pt of points.slice(1)) {
    parts.push(`L ${round(pt.x)} ${round(pt.y)}`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computeBumpChart(input: ComputeBumpChartInput): BumpChartModel {
  const {
    rows,
    highlightTeams,
    interpolation = "smooth",
    showEndLabels = true,
    showStartLabels = false,
    rankDomain: explicitRankDomain,
    teamColors = {},
    timepointLabel = "Matchweek",
    rankLabel = "Position",
    endLabelsForAllTeams = false,
    startLabelsForAllTeams = false,
    axisPadding = DEFAULT_AXIS_PADDING,
  } = input;

  const [gutterX, gutterY] = resolveAxisPadding(axisPadding);
  const frame = { x: MARGIN.left, y: MARGIN.top, width: PLOT_W, height: PLOT_H };
  const plotArea = applyAxisPadding(frame, [gutterX, gutterY]);

  const warnings: string[] = [];
  const totalRows = rows.length;

  // ---- validate rows -------------------------------------------------------
  const validRows = rows.filter(isValidRow);
  const excludedCount = totalRows - validRows.length;

  if (excludedCount > 0) {
    warnings.push(
      `${excludedCount} row(s) excluded: missing team, timepoint, or invalid rank`,
    );
  }

  if (validRows.length === 0) {
    return emptyModel(totalRows, warnings);
  }

  // ---- group by team -------------------------------------------------------
  const teamMap = new Map<string, { rows: BumpChartRow[]; label: string }>();

  for (const row of validRows) {
    let entry = teamMap.get(row.team);
    if (!entry) {
      entry = { rows: [], label: row.label ?? row.team };
      teamMap.set(row.team, entry);
    }
    entry.rows.push(row);
    // Use the latest label if provided
    if (row.label) entry.label = row.label;
  }

  const teamIds = Array.from(teamMap.keys());
  const totalTeams = teamIds.length;

  if (totalTeams === 1) {
    warnings.push("Only 1 team in data; bump chart has limited comparison value");
  }

  // ---- determine highlight set ---------------------------------------------
  const highlightSet = new Set<string>();
  if (highlightTeams && highlightTeams.length > 0) {
    for (const t of highlightTeams.slice(0, MAX_HIGHLIGHT)) {
      if (teamMap.has(t)) highlightSet.add(t);
    }
    if (highlightTeams.length > MAX_HIGHLIGHT) {
      warnings.push(
        `highlightTeams truncated to ${MAX_HIGHLIGHT}; ${highlightTeams.length - MAX_HIGHLIGHT} team(s) ignored`,
      );
    }
  }
  const hasHighlighting = highlightSet.size > 0;
  const highlightedTeamCount = hasHighlighting ? highlightSet.size : totalTeams;

  // ---- determine domains ---------------------------------------------------
  const [minTime = Infinity, maxTime = -Infinity] = d3Extent(
    validRows,
    (r) => r.timepoint,
  );
  const [minRank = Infinity, maxRank = -Infinity] = d3Extent(validRows, (r) => r.rank);

  // Use explicit rank domain if provided, otherwise infer from data
  const rankMin = explicitRankDomain ? explicitRankDomain[0] : minRank;
  const rankMax = explicitRankDomain ? explicitRankDomain[1] : maxRank;

  // ---- scales ---------------------------------------------------------------
  // X: timepoints left to right
  const xScale = createLinearScale([minTime, maxTime], [gutterX, PLOT_W - gutterX]);

  // Y: rank 1 at top, rank N at bottom (inverted: lower rank → higher y in SVG)
  const yScale = createLinearScale([rankMin, rankMax], [gutterY, PLOT_H - gutterY]);

  // Y bounds in SVG coordinates for clamping
  const yBoundTop = MARGIN.top;
  const yBoundBottom = MARGIN.top + PLOT_H;

  // ---- x-axis ticks ---------------------------------------------------------
  const allTimepoints = Array.from(new Set(validRows.map((r) => r.timepoint))).sort(
    (a, b) => a - b,
  );

  let xTicks: number[];
  if (allTimepoints.length <= MAX_X_TICKS) {
    xTicks = allTimepoints;
  } else {
    // Thin: show every Nth tick to stay under MAX_X_TICKS
    const step = Math.ceil(allTimepoints.length / MAX_X_TICKS);
    xTicks = allTimepoints.filter((_, i) => i % step === 0);
    // Always include the last timepoint
    const last = allTimepoints[allTimepoints.length - 1] as number;
    if (xTicks[xTicks.length - 1] !== last) {
      xTicks.push(last);
    }
  }

  // ---- y-axis ticks (integer rank positions) --------------------------------
  const yTicks: number[] = [];
  for (let r = rankMin; r <= rankMax; r++) {
    yTicks.push(r);
  }

  // ---- gap detection --------------------------------------------------------
  // The path builders interpolate straight (linear) or smoothly (Catmull-Rom)
  // through any team's row sequence. If a team is missing one or more
  // timepoints that other teams have, the line is drawn confidently across the
  // gap with no visual cue. Surface this as a warning so consumers know the
  // chart is silently bridging gaps in their data.
  const teamsWithGaps: string[] = [];
  for (const [team, entry] of teamMap) {
    if (entry.rows.length < allTimepoints.length) {
      teamsWithGaps.push(team);
    }
  }
  if (teamsWithGaps.length > 0) {
    const sample = teamsWithGaps.slice(0, 3).join(", ");
    const suffix = teamsWithGaps.length > 3 ? `, +${teamsWithGaps.length - 3} more` : "";
    warnings.push(
      `${teamsWithGaps.length} team(s) have gaps in timepoints — lines interpolate across missing matchweeks: ${sample}${suffix}`,
    );
  }

  // ---- assign colors --------------------------------------------------------
  function colorForTeam(team: string, index: number): string {
    if (teamColors[team]) return teamColors[team];
    if (hasHighlighting && !highlightSet.has(team)) return BACKGROUND_COLOR;
    return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] as string;
  }

  // ---- build lines ----------------------------------------------------------
  // Sort teams: highlighted first, then by final rank for consistent rendering
  const sortedTeamIds = [...teamIds].sort((a, b) => {
    const aHighlighted = !hasHighlighting || highlightSet.has(a);
    const bHighlighted = !hasHighlighting || highlightSet.has(b);
    if (aHighlighted !== bHighlighted) return aHighlighted ? 1 : -1; // highlighted last (drawn on top)

    const aEntry = teamMap.get(a) as { rows: BumpChartRow[]; label: string };
    const bEntry = teamMap.get(b) as { rows: BumpChartRow[]; label: string };
    const aFinal = (aEntry.rows[aEntry.rows.length - 1] as BumpChartRow).rank;
    const bFinal = (bEntry.rows[bEntry.rows.length - 1] as BumpChartRow).rank;
    return aFinal - bFinal;
  });

  const lines: BumpChartLineModel[] = [];

  for (const team of sortedTeamIds) {
    const entry = teamMap.get(team) as { rows: BumpChartRow[]; label: string };
    const teamRows = [...entry.rows].sort((a, b) => a.timepoint - b.timepoint);

    const isHighlighted = !hasHighlighting || highlightSet.has(team);

    // Find the original index for color assignment (before sorting)
    const originalIndex = teamIds.indexOf(team);
    const color = colorForTeam(team, originalIndex);

    // Build SVG points
    const svgPoints: Point[] = [];
    const modelPoints: BumpChartPointModel[] = [];

    for (const row of teamRows) {
      const cx = MARGIN.left + xScale(row.timepoint);
      const cy = MARGIN.top + yScale(row.rank);

      svgPoints.push({ x: cx, y: cy });
      modelPoints.push({
        timepoint: row.timepoint,
        rank: row.rank,
        cx,
        cy,
        value: row.value ?? null,
        displayValue:
          row.displayValue ?? (row.value != null ? `${row.value}` : `#${row.rank}`),
      });
    }

    // Build path
    const path =
      interpolation === "linear"
        ? buildLinearPath(svgPoints)
        : buildSmoothPath(svgPoints, yBoundTop, yBoundBottom);

    const firstRow = teamRows[0] as BumpChartRow;
    const lastRow = teamRows[teamRows.length - 1] as BumpChartRow;

    lines.push({
      team,
      teamLabel: entry.label,
      color,
      highlighted: isHighlighted,
      path,
      points: modelPoints,
      finalRank: lastRow.rank,
      startRank: firstRow.rank,
    });
  }

  // ---- end labels -----------------------------------------------------------
  const endLabels: BumpChartEndLabelModel[] = [];

  if (showEndLabels) {
    const endLabelX = MARGIN.left + PLOT_W + 8;

    // Collect raw positions
    type RawEndLabel = {
      team: string;
      teamLabel: string;
      rawY: number;
      color: string;
      rank: number;
    };

    const rawLabels: RawEndLabel[] = lines
      .filter((l) => endLabelsForAllTeams || l.highlighted)
      .map((l) => ({
        team: l.team,
        teamLabel: truncate(l.teamLabel, 12),
        rawY: MARGIN.top + yScale(l.finalRank),
        color: l.color,
        rank: l.finalRank,
      }))
      .sort((a, b) => a.rawY - b.rawY); // sort by y position

    // Resolve overlaps by pushing labels apart
    const resolvedYs = resolveOverlaps(
      rawLabels.map((l) => l.rawY),
      END_LABEL_MIN_GAP,
    );

    for (let i = 0; i < rawLabels.length; i++) {
      const raw = rawLabels[i] as (typeof rawLabels)[number];
      endLabels.push({
        team: raw.team,
        teamLabel: raw.teamLabel,
        x: endLabelX,
        y: resolvedYs[i] as number,
        color: raw.color,
        rank: raw.rank,
      });
    }
  }

  // ---- start labels ---------------------------------------------------------
  const startLabels: BumpChartStartLabelModel[] = [];

  if (showStartLabels) {
    const startLabelX = MARGIN.left - 8;

    type RawStartLabel = {
      team: string;
      teamLabel: string;
      rawY: number;
      color: string;
      rank: number;
    };

    const rawLabels: RawStartLabel[] = lines
      .filter((l) => startLabelsForAllTeams || l.highlighted)
      .map((l) => ({
        team: l.team,
        teamLabel: truncate(l.teamLabel, 12),
        rawY: MARGIN.top + yScale(l.startRank),
        color: l.color,
        rank: l.startRank,
      }))
      .sort((a, b) => a.rawY - b.rawY);

    const resolvedYs = resolveOverlaps(
      rawLabels.map((l) => l.rawY),
      END_LABEL_MIN_GAP,
    );

    for (let i = 0; i < rawLabels.length; i++) {
      const raw = rawLabels[i] as (typeof rawLabels)[number];
      startLabels.push({
        team: raw.team,
        teamLabel: raw.teamLabel,
        x: startLabelX,
        y: resolvedYs[i] as number,
        color: raw.color,
        rank: raw.rank,
      });
    }
  }

  // ---- accessible label -----------------------------------------------------
  const accessibleLabel =
    `Bump chart: ${totalTeams} team${totalTeams !== 1 ? "s" : ""} ` +
    `over ${allTimepoints.length} matchweek${allTimepoints.length !== 1 ? "s" : ""}` +
    (hasHighlighting ? `, ${highlightSet.size} highlighted` : "");

  return {
    meta: {
      component: "BumpChart",
      empty: false,
      totalRows,
      validRows: validRows.length,
      totalTeams,
      highlightedTeams: highlightedTeamCount,
      warnings,
      accessibleLabel,
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea,
      frame,
    },
    axes: {
      x: {
        label: timepointLabel,
        domain: [minTime, maxTime],
        ticks: xTicks,
      },
      y: {
        label: rankLabel,
        domain: [rankMin, rankMax],
        ticks: yTicks,
      },
    },
    lines,
    endLabels,
    startLabels,
    emptyState: null,
  };
}

// ---------------------------------------------------------------------------
// Overlap resolution
// ---------------------------------------------------------------------------

/**
 * Resolve vertical overlaps in a sorted array of y-positions.
 * Pushes labels apart until all have at least `minGap` between them.
 */
function resolveOverlaps(sortedYs: number[], minGap: number): number[] {
  if (sortedYs.length <= 1) return [...sortedYs];

  const result = [...sortedYs];

  // Forward pass: push down labels that are too close
  for (let i = 1; i < result.length; i++) {
    const curr = result[i] as number;
    const prev = result[i - 1] as number;
    if (curr - prev < minGap) {
      result[i] = prev + minGap;
    }
  }

  // Backward pass: if we pushed labels too far down, pull them back up
  for (let i = result.length - 2; i >= 0; i--) {
    const next = result[i + 1] as number;
    const curr = result[i] as number;
    if (next - curr < minGap) {
      result[i] = next - minGap;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Empty model
// ---------------------------------------------------------------------------

function emptyModel(totalRows: number, warnings: string[]): BumpChartModel {
  const emptyFrame = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: PLOT_W,
    height: PLOT_H,
  };
  return {
    meta: {
      component: "BumpChart",
      empty: true,
      totalRows,
      validRows: 0,
      totalTeams: 0,
      highlightedTeams: 0,
      warnings,
      accessibleLabel: "Bump chart: no ranking data",
    },
    layout: {
      viewBox: { width: VIEWBOX_W, height: VIEWBOX_H },
      plotArea: emptyFrame,
      frame: emptyFrame,
    },
    axes: {
      x: {
        label: "Matchweek",
        domain: [1, 38],
        ticks: [1, 5, 10, 15, 20, 25, 30, 35, 38],
      },
      y: {
        label: "Position",
        domain: [1, 20],
        ticks: Array.from({ length: 20 }, (_, i) => i + 1),
      },
    },
    lines: [],
    endLabels: [],
    startLabels: [],
    emptyState: { message: "No ranking data" },
  };
}
