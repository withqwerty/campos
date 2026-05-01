import { max as d3Max, min as d3Min } from "d3-array";

import { hexToRgb } from "./color.js";
import type { HeaderStatsItem } from "./shot-map.js";
import { clamp, isFiniteNumber } from "./math.js";

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export type PassNetworkNode = {
  /** Stable identifier. Must match sourceId/targetId referenced by edges. */
  id: string;
  /** Short display label rendered inside the circle (prefer initials). */
  label: string;
  /** Full name used in the tooltip. Falls back to `label` when absent. */
  labelFull?: string;
  /** Campos pitch x-coordinate (0-100). */
  x: number;
  /** Campos pitch y-coordinate (0-100). */
  y: number;
  /** Pass count in the window. Drives node size by default. */
  passCount: number;
  /** Optional expected-threat value. */
  xT?: number | null;
  /** Optional pass completion percentage (0-1). */
  completionRate?: number | null;
  /**
   * Optional solid color override. When set, overrides the team/xT color
   * for just this node — used by H2H compose flows that combine two
   * team-tagged networks through a single chart instance.
   */
  color?: string;
  /** Opaque bag of extra rows rendered in the tooltip. */
  meta?: Readonly<Record<string, string | number>>;
};

export type PassNetworkEdge = {
  sourceId: string;
  targetId: string;
  /** Undirected pass count between the pair. */
  passCount: number;
  /** Optional expected-threat value between the pair. */
  xT?: number | null;
  /**
   * Optional solid color override. When set, overrides the team/xT color
   * for just this edge — used by H2H compose flows that combine two
   * team-tagged networks through a single chart instance.
   */
  color?: string;
};

export type PassNetworkColorBy = "team" | "xT";

export type ComputePassNetworkInput = {
  nodes: readonly PassNetworkNode[];
  edges: readonly PassNetworkEdge[];
  minEdgePasses?: number;
  showLabels?: boolean;
  attackingDirection?: "up" | "down" | "left" | "right";
  /**
   * Minimum gap (SVG user units / meters) between two node edges after
   * collision relaxation. Set to 0 to disable relaxation entirely. Default: 0.5.
   */
  collisionPadding?: number;
  /**
   * When true, reversed edges (A→B and B→A) are kept as distinct marks and
   * the renderer draws them as tapered polygons with a slight perpendicular
   * offset to avoid overlap. Default: false (undirected merge).
   */
  directed?: boolean;
};

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export type PassNetworkTooltipRow = {
  key: string;
  label: string;
  value: string;
};

export type PassNetworkTooltipModel = {
  rows: PassNetworkTooltipRow[];
};

export type PassNetworkRenderedNode = {
  id: string;
  label: string;
  /** Possibly-displaced Campos coordinates (0-100). */
  x: number;
  y: number;
  /** Rendered radius in SVG user units (meters). */
  radius: number;
  /** Label font size in SVG user units (meters). Scaled from radius. */
  labelFontSize: number;
  /** Resolved fill color (hex). */
  color: string;
  /** Resolved label color for readable contrast against the fill. */
  labelColor: string;
  /** Whether the label should be rendered at all (large enough + showLabels). */
  showLabel: boolean;
  /** Normalized size weight used for the scale (0-1). */
  sizeWeight: number;
  /** True when collision relaxation moved this node from its input position. */
  displaced: boolean;
  tooltip: PassNetworkTooltipModel;
};

export type PassNetworkRenderedEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** Undirected pass count (post-merge) or directed count when isDirected. */
  passCount: number;
  /** Merged xT value (passCount-weighted mean) or directed xT. */
  xT: number | null;
  /** True when this edge represents a single direction (directed mode). */
  isDirected: boolean;
  /** Stroke width in SVG user units (meters). */
  width: number;
  /** Resolved stroke color (hex). */
  color: string;
  /** Stroke opacity (0-1). */
  opacity: number;
  /** Endpoint labels for the tooltip. */
  sourceLabel: string;
  targetLabel: string;
  tooltip: PassNetworkTooltipModel;
};

export type PassNetworkLegendSizeRow = {
  kind: "size";
  label: string;
  minLabel: string;
  maxLabel: string;
  minRadius: number;
  maxRadius: number;
  color: string;
};

export type PassNetworkLegendWidthRow = {
  kind: "width";
  label: string;
  minLabel: string;
  maxLabel: string;
  minWidth: number;
  maxWidth: number;
  color: string;
};

export type PassNetworkLegendColorRow =
  | {
      kind: "color";
      mode: "team";
      label: string;
      color: string;
    }
  | {
      kind: "color";
      mode: "xT";
      label: string;
      gradient: readonly string[];
      minLabel: string;
      maxLabel: string;
    };

export type PassNetworkLegendRow =
  | PassNetworkLegendSizeRow
  | PassNetworkLegendWidthRow
  | PassNetworkLegendColorRow;

export type PassNetworkLegendModel = {
  rows: PassNetworkLegendRow[];
};

export type PassNetworkLayoutModel = {
  order: Array<"headerStats" | "plot" | "legend">;
  aspectRatio: string;
  minPlotHeightRatio: number;
};

export type PassNetworkModel = {
  meta: {
    component: "PassNetwork";
    empty: boolean;
    noEdgesAboveThreshold: boolean;
    accessibleLabel: string;
    colorBy: PassNetworkColorBy;
    /** Set to "team" when xT mode silently falls back due to all-null xT. */
    colorFallback: "team" | null;
    attackingDirection: "up" | "down" | "left" | "right";
    minEdgePasses: number;
    warnings: readonly string[];
  };
  layout: PassNetworkLayoutModel;
  headerStats: { items: HeaderStatsItem[] } | null;
  plot: {
    pitch: { attackingDirection: "up" | "down" | "left" | "right" };
    nodes: PassNetworkRenderedNode[];
    edges: PassNetworkRenderedEdge[];
  };
  legend: PassNetworkLegendModel | null;
  emptyState: { message: string; secondary?: string } | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// FIFA-standard pitch dimensions in meters. Mirrors @withqwerty/campos-stadia's constants.
const PITCH_LENGTH = 105;
const PITCH_WIDTH = 68;

// Node/edge sizing is expressed as a fraction of the *visible* viewport's
// shorter side so that a full pitch and a cropped pitch render at visually
// comparable scales. 5.5% of the short side gives ~3.7m (full) / ~2.9m (half).
const NODE_MAX_RADIUS_RATIO = 0.055;
const NODE_MIN_RADIUS_RATIO = 0.025;
const EDGE_MAX_WIDTH_RATIO = 0.022;
const EDGE_MIN_WIDTH_RATIO = 0.004;
const LABEL_FONT_RATIO = 0.72;

const DEFAULT_MIN_EDGE_PASSES = 4;
const MIN_EDGE_OPACITY = 0.35;
const MAX_EDGE_OPACITY = 1.0;
const DEFAULT_TEAM_COLOR = "#f05252";

function viewportShortSide(): number {
  // The chart always renders on the full pitch, so the short side is the
  // pitch width.
  return Math.min(PITCH_LENGTH, PITCH_WIDTH);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aspectRatioFor(direction: "up" | "down" | "left" | "right"): string {
  // Match the stadia pitch viewBox exactly so the outer section and the inner
  // SVG agree on height. Stadia computes: full = 105×68. Each orientation
  // swaps length and width.
  const isHorizontal = direction === "left" || direction === "right";
  return isHorizontal ? "105:68" : "68:105";
}

/** Relative luminance-ish check for picking a readable label color. */
function preferDarkLabel(hex: string): boolean {
  if (hex.replace("#", "").length !== 6) return false;
  const [r, g, b] = hexToRgb(hex);
  // Rec. 601 luma approximation is sufficient for label contrast decisions.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6;
}

function formatRate(rate: number | null | undefined): string | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return `${Math.round(rate * 100)}%`;
}

function formatXT(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  // Keep the xT display compact. Values in real data land around 0.00-2.00.
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

/**
 * Pairwise collision relaxation — nudges overlapping nodes apart while
 * preserving each pair's centroid. Campos coordinates are in [0, 100] but the
 * separation check is done in pitch meters so the padding reads intuitively.
 *
 * Up to `iterations` passes of O(n²) pair checks. For each pair whose
 * separation (in meters) is below (sum of radii + padding), split the overlap
 * evenly and push each node half the delta along the axis between them.
 * Converges within a few iterations for the ≤11 nodes a starting XI produces;
 * never runs force-directed simulation because spatial meaning matters here.
 */
function relaxCollisions(
  nodes: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    radius: number;
  }>,
  paddingMeters: number,
  metersPerCamposX: number,
  metersPerCamposY: number,
  iterations = 8,
): Map<string, { x: number; y: number; displaced: boolean }> {
  const result = new Map<string, { x: number; y: number; displaced: boolean }>();
  for (const n of nodes) {
    result.set(n.id, { x: n.x, y: n.y, displaced: false });
  }
  if (paddingMeters <= 0 || nodes.length < 2) return result;

  for (let iter = 0; iter < iterations; iter++) {
    let anyMoved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeI = nodes[i] as (typeof nodes)[number];
        const nodeJ = nodes[j] as (typeof nodes)[number];
        const a = result.get(nodeI.id) as { x: number; y: number; displaced: boolean };
        const b = result.get(nodeJ.id) as { x: number; y: number; displaced: boolean };
        const dxMeters = (b.x - a.x) * metersPerCamposX;
        const dyMeters = (b.y - a.y) * metersPerCamposY;
        const distMeters = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
        const required = nodeI.radius + nodeJ.radius + paddingMeters;
        if (distMeters >= required) continue;
        if (distMeters < 1e-6) {
          // Exactly coincident — pick a deterministic unit vector along x.
          const halfMeters = required / 2;
          a.x -= halfMeters / metersPerCamposX;
          b.x += halfMeters / metersPerCamposX;
          a.displaced = true;
          b.displaced = true;
          anyMoved = true;
          continue;
        }
        const overlapMeters = required - distMeters;
        const halfMeters = overlapMeters / 2;
        const uxMeters = dxMeters / distMeters;
        const uyMeters = dyMeters / distMeters;
        a.x -= (uxMeters * halfMeters) / metersPerCamposX;
        a.y -= (uyMeters * halfMeters) / metersPerCamposY;
        b.x += (uxMeters * halfMeters) / metersPerCamposX;
        b.y += (uyMeters * halfMeters) / metersPerCamposY;
        a.displaced = true;
        b.displaced = true;
        anyMoved = true;
      }
    }
    if (!anyMoved) break;
  }

  for (const v of result.values()) {
    v.x = Math.max(0, Math.min(100, v.x));
    v.y = Math.max(0, Math.min(100, v.y));
  }
  return result;
}

function buildNodeTooltip(
  node: PassNetworkNode,
  resolvedXT: number | null,
): PassNetworkTooltipModel {
  const rows: PassNetworkTooltipRow[] = [
    { key: "player", label: "Player", value: node.labelFull ?? node.label },
    { key: "passes", label: "Passes", value: String(node.passCount) },
  ];
  const completion = formatRate(node.completionRate);
  if (completion != null) {
    rows.push({ key: "completion", label: "Completion", value: completion });
  }
  const xTText = formatXT(resolvedXT);
  if (xTText != null) {
    rows.push({ key: "xt", label: "xT", value: xTText });
  }
  if (node.meta) {
    for (const [key, value] of Object.entries(node.meta)) {
      rows.push({ key: `meta-${key}`, label: key, value: String(value) });
    }
  }
  return { rows };
}

function buildEdgeTooltip(
  sourceLabel: string,
  targetLabel: string,
  passCount: number,
  xT: number | null,
): PassNetworkTooltipModel {
  const rows: PassNetworkTooltipRow[] = [
    { key: "pair", label: "Connection", value: `${sourceLabel} ↔ ${targetLabel}` },
    { key: "passes", label: "Passes", value: String(passCount) },
  ];
  const xTText = formatXT(xT);
  if (xTText != null) {
    rows.push({ key: "xt", label: "xT", value: xTText });
  }
  return { rows };
}

// ---------------------------------------------------------------------------
// Main compute
// ---------------------------------------------------------------------------

/**
 * Compute a renderer-neutral semantic model for the Campos PassNetwork.
 *
 * Consumes pre-aggregated nodes and edges. Aggregation from raw PassEvent
 * arrays lives in a dedicated helper (deferred; see passnetwork-spec.md).
 */
export function computePassNetwork(input: ComputePassNetworkInput): PassNetworkModel {
  const colorBy: PassNetworkColorBy = "team";
  const attackingDirection: "up" | "down" | "left" | "right" =
    input.attackingDirection ?? "right";
  const isHorizontal = attackingDirection === "left" || attackingDirection === "right";
  const showLabels = input.showLabels ?? true;
  const nodeColor = DEFAULT_TEAM_COLOR;
  const minEdgePasses = Math.max(
    0,
    Math.floor(input.minEdgePasses ?? DEFAULT_MIN_EDGE_PASSES),
  );

  const warnings: string[] = [];

  // 1 + 2: clamp + drop incomplete nodes
  const cleanedNodes: PassNetworkNode[] = [];
  for (const node of input.nodes) {
    if (
      typeof node.id !== "string" ||
      node.id.length === 0 ||
      typeof node.label !== "string" ||
      node.label.length === 0 ||
      !isFiniteNumber(node.x) ||
      !isFiniteNumber(node.y) ||
      !isFiniteNumber(node.passCount)
    ) {
      warnings.push(`Dropped node with missing required fields: ${node.id}`);
      continue;
    }
    const clampedX = clamp(node.x, 0, 100);
    const clampedY = clamp(node.y, 0, 100);
    if (clampedX !== node.x || clampedY !== node.y) {
      warnings.push(`Clamped out-of-range coordinates for node ${node.id}`);
    }
    cleanedNodes.push({
      ...node,
      x: clampedX,
      y: clampedY,
    });
  }

  // 3: dedupe by id
  const seenIds = new Set<string>();
  const dedupedNodes: PassNetworkNode[] = [];
  for (const node of cleanedNodes) {
    if (seenIds.has(node.id)) {
      warnings.push(`Dropped duplicate node id: ${node.id}`);
      continue;
    }
    seenIds.add(node.id);
    dedupedNodes.push(node);
  }

  const validNodes = dedupedNodes;
  const survivingIds = new Set(validNodes.map((n) => n.id));

  // Drop edges referencing unknown nodes
  const validEdges: PassNetworkEdge[] = [];
  for (const edge of input.edges) {
    if (
      typeof edge.sourceId !== "string" ||
      typeof edge.targetId !== "string" ||
      !isFiniteNumber(edge.passCount)
    ) {
      warnings.push(`Dropped edge with missing required fields`);
      continue;
    }
    if (edge.sourceId === edge.targetId) {
      warnings.push(`Dropped self-loop edge for node ${edge.sourceId}`);
      continue;
    }
    if (!survivingIds.has(edge.sourceId) || !survivingIds.has(edge.targetId)) {
      warnings.push(
        `Dropped edge referencing unknown or cropped-out node: ${edge.sourceId}↔${edge.targetId}`,
      );
      continue;
    }
    validEdges.push(edge);
  }

  // 6: merge (undirected) or keep distinct (directed)
  const directed = input.directed ?? false;
  type MergedEdge = {
    sourceId: string;
    targetId: string;
    passCount: number;
    xT: number | null;
    colorOverride: string | null;
  };
  let mergedEdges: MergedEdge[];

  if (directed) {
    // Keep every valid edge as-is. Sort for deterministic rendering order.
    mergedEdges = validEdges
      .slice()
      .sort((a, b) => {
        if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
        return a.targetId < b.targetId ? -1 : 1;
      })
      .map((edge) => ({
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        passCount: edge.passCount,
        xT: edge.xT != null && Number.isFinite(edge.xT) ? edge.xT : null,
        colorOverride: edge.color ?? null,
      }))
      .filter((e) => e.passCount >= minEdgePasses);
  } else {
    type MergeBucket = {
      key: string;
      sourceId: string;
      targetId: string;
      passCount: number;
      xTWeighted: number; // sum of passCount * xT
      xTWeightSum: number; // sum of passCount where xT is non-null
      xTObserved: boolean;
      colorOverride: string | null;
    };
    const buckets = new Map<string, MergeBucket>();
    // Track exact directed pairs we've already seen so we can flag *literal*
    // duplicates (same sourceId → same targetId twice). Merging a reversed
    // pair (A→B + B→A) is expected in undirected mode and does not warrant
    // a warning.
    const seenDirected = new Set<string>();
    for (const edge of validEdges) {
      const directedKey = `${edge.sourceId}->${edge.targetId}`;
      if (seenDirected.has(directedKey)) {
        warnings.push(
          `Dropped duplicate edge: ${edge.sourceId}→${edge.targetId} appeared twice`,
        );
      }
      seenDirected.add(directedKey);

      const [a, b] =
        edge.sourceId <= edge.targetId
          ? [edge.sourceId, edge.targetId]
          : [edge.targetId, edge.sourceId];
      const key = `${a}::${b}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          key,
          sourceId: a,
          targetId: b,
          passCount: 0,
          xTWeighted: 0,
          xTWeightSum: 0,
          xTObserved: false,
          colorOverride: edge.color ?? null,
        };
        buckets.set(key, bucket);
      }
      bucket.passCount += edge.passCount;
      if (edge.xT != null && Number.isFinite(edge.xT)) {
        bucket.xTWeighted += edge.passCount * edge.xT;
        bucket.xTWeightSum += edge.passCount;
        bucket.xTObserved = true;
      }
    }

    // 7: threshold
    mergedEdges = Array.from(buckets.values())
      .filter((b) => b.passCount >= minEdgePasses)
      .map((b) => ({
        sourceId: b.sourceId,
        targetId: b.targetId,
        passCount: b.passCount,
        xT: b.xTObserved && b.xTWeightSum > 0 ? b.xTWeighted / b.xTWeightSum : null,
        colorOverride: b.colorOverride,
      }));
  }

  // Baseline layout (used even in empty state).
  const layout: PassNetworkLayoutModel = {
    order: ["headerStats", "plot", "legend"],
    aspectRatio: aspectRatioFor(attackingDirection),
    minPlotHeightRatio: 0.6,
  };

  // Empty state.
  if (validNodes.length === 0) {
    return {
      meta: {
        component: "PassNetwork",
        empty: true,
        noEdgesAboveThreshold: false,
        accessibleLabel: "Passing network: 0 players, 0 connections",
        colorBy,
        colorFallback: null,
        attackingDirection,
        minEdgePasses,
        warnings,
      },
      layout,
      headerStats: {
        items: [
          { label: "Players", value: "0" },
          { label: "Connections", value: "0" },
        ],
      },
      plot: {
        pitch: { attackingDirection },
        nodes: [],
        edges: [],
      },
      legend: null,
      emptyState: { message: "No passing network data" },
    };
  }

  // 8: scales
  const nodePassCounts = validNodes.map((n) => n.passCount);
  const nodeMin = d3Min(nodePassCounts) ?? 0;
  const nodeMax = d3Max(nodePassCounts) ?? 0;
  const nodeDomainIsDegenerate = nodeMin === nodeMax;
  const edgeCounts = mergedEdges.map((e) => e.passCount);
  const edgeMin = d3Min(edgeCounts) ?? 0;
  const edgeMax = d3Max(edgeCounts) ?? 0;
  const edgeDomainIsDegenerate = edgeCounts.length < 2 || edgeMin === edgeMax;

  // Viewport-relative sizing. The chart always renders on the full pitch
  // so both orientations share the same short side (the pitch width).
  const shortSide = viewportShortSide();
  const minRadius = shortSide * NODE_MIN_RADIUS_RATIO;
  const maxRadius = shortSide * NODE_MAX_RADIUS_RATIO;
  const midRadius = (minRadius + maxRadius) / 2;
  const minWidth = shortSide * EDGE_MIN_WIDTH_RATIO;
  const maxWidth = shortSide * EDGE_MAX_WIDTH_RATIO;
  const midWidth = (minWidth + maxWidth) / 2;

  const nodeRadiusFor = (passCount: number): { radius: number; weight: number } => {
    if (nodeDomainIsDegenerate) return { radius: midRadius, weight: 0.5 };
    const t = (passCount - nodeMin) / (nodeMax - nodeMin);
    return { radius: minRadius + t * (maxRadius - minRadius), weight: t };
  };

  const edgeWidthFor = (passCount: number): { width: number; weight: number } => {
    if (edgeDomainIsDegenerate) return { width: midWidth, weight: 0.5 };
    const t = (passCount - edgeMin) / (edgeMax - edgeMin);
    return { width: minWidth + t * (maxWidth - minWidth), weight: t };
  };

  const edgeOpacityFor = (weight: number): number =>
    MIN_EDGE_OPACITY + (MAX_EDGE_OPACITY - MIN_EDGE_OPACITY) * weight;

  const nodeColorFor = (node: PassNetworkNode): string => {
    // A per-node override wins over both the team and xT palettes. Used
    // by H2H compose flows that combine two team-tagged networks through
    // a single chart instance.
    if (node.color != null) return node.color;
    return nodeColor;
  };

  const edgeColorFor = (): string => {
    return nodeColor;
  };

  // Relax overlapping nodes before building the rendered set. 1 Campos unit
  // spans pitchDim / 100 meters on each axis. The chart always renders on
  // the full pitch so the dimensions only depend on orientation.
  const pitchMetersWide = isHorizontal ? PITCH_LENGTH : PITCH_WIDTH;
  const pitchMetersTall = isHorizontal ? PITCH_WIDTH : PITCH_LENGTH;
  const metersPerCamposX = pitchMetersWide / 100;
  const metersPerCamposY = pitchMetersTall / 100;
  const paddingMeters = input.collisionPadding ?? 0.5;
  const nodeRadiusCache = validNodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    radius: nodeRadiusFor(n.passCount).radius,
  }));
  const relaxed = relaxCollisions(
    nodeRadiusCache,
    paddingMeters,
    metersPerCamposX,
    metersPerCamposY,
  );

  // Build rendered nodes
  const renderedNodes: PassNetworkRenderedNode[] = validNodes.map((node) => {
    const { radius, weight } = nodeRadiusFor(node.passCount);
    const color = nodeColorFor(node);
    const labelColor = preferDarkLabel(color) ? "#1a202c" : "#ffffff";
    const resolvedXT = node.xT ?? null;
    const position = relaxed.get(node.id) as { x: number; y: number; displaced: boolean };
    return {
      id: node.id,
      label: node.label,
      x: position.x,
      y: position.y,
      radius,
      labelFontSize: radius * LABEL_FONT_RATIO,
      color,
      labelColor,
      showLabel: showLabels,
      sizeWeight: weight,
      displaced: position.displaced,
      tooltip: buildNodeTooltip(node, resolvedXT),
    };
  });

  // Lookup for rendered edges
  const nodeById = new Map(renderedNodes.map((n) => [n.id, n]));

  const renderedEdges: PassNetworkRenderedEdge[] = mergedEdges.map((edge) => {
    const source = nodeById.get(edge.sourceId);
    const target = nodeById.get(edge.targetId);
    // Defensive: these must exist after crop+validation, but keep the guard.
    if (!source || !target) {
      throw new Error(
        `Internal error: edge references missing node ${edge.sourceId}↔${edge.targetId}`,
      );
    }
    const { width, weight } = edgeWidthFor(edge.passCount);
    const opacity = edgeOpacityFor(weight);
    const color = edge.colorOverride ?? edgeColorFor();
    return {
      id: `${edge.sourceId}::${edge.targetId}`,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      passCount: edge.passCount,
      xT: edge.xT,
      isDirected: directed,
      width,
      color,
      opacity,
      sourceLabel: source.label,
      targetLabel: target.label,
      tooltip: buildEdgeTooltip(source.label, target.label, edge.passCount, edge.xT),
    };
  });

  // 9: legend
  const legendRows: PassNetworkLegendRow[] = [];
  if (renderedNodes.length >= 2 && !nodeDomainIsDegenerate) {
    legendRows.push({
      kind: "size",
      label: "Node size",
      minLabel: "Fewer passes",
      maxLabel: "More passes",
      minRadius,
      maxRadius,
      color: nodeColor,
    });
  }
  if (renderedEdges.length >= 2 && !edgeDomainIsDegenerate) {
    legendRows.push({
      kind: "width",
      label: "Edge width",
      minLabel: "Fewer passes",
      maxLabel: "More passes",
      minWidth,
      maxWidth,
      color: nodeColor,
    });
  }
  if (
    renderedNodes.length >= 2 &&
    (legendRows.length === 0 || legendRows[0]?.kind !== "size")
  ) {
    // Only emit a team-color row when neither size nor width rows carry it
    // (they already show the team color via their sample glyphs).
    legendRows.push({
      kind: "color",
      mode: "team",
      label: "Team",
      color: nodeColor,
    });
  }
  const legend: PassNetworkLegendModel | null =
    legendRows.length > 0 ? { rows: legendRows } : null;

  // 10: header
  const headerItems: HeaderStatsItem[] = [
    { label: "Players", value: String(renderedNodes.length) },
    { label: "Connections", value: String(renderedEdges.length) },
    { label: "Threshold", value: `≥${minEdgePasses} passes` },
  ];

  const noEdgesAboveThreshold = renderedEdges.length === 0;

  const accessibleLabel = `Passing network: ${renderedNodes.length} players, ${renderedEdges.length} connections`;

  return {
    meta: {
      component: "PassNetwork",
      empty: false,
      noEdgesAboveThreshold,
      accessibleLabel,
      colorBy,
      colorFallback: null,
      attackingDirection,
      minEdgePasses,
      warnings,
    },
    layout,
    headerStats: { items: headerItems },
    plot: {
      pitch: { attackingDirection },
      nodes: renderedNodes,
      edges: renderedEdges,
    },
    legend,
    emptyState: noEdgesAboveThreshold
      ? {
          message: "No connections above threshold",
          secondary: `Increase input passes or lower minEdgePasses (currently ${minEdgePasses}).`,
        }
      : null,
  };
}
