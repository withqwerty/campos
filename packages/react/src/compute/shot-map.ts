import { hasRealXg, type Shot } from "@withqwerty/campos-schema";
import { sum as d3Sum } from "d3-array";

import { interpolateStops } from "./color.js";
import { formatMinute } from "./math.js";
import type { SharedPitchScale } from "./shared-pitch-scale.js";

// ─── Types ──────────────────────────────────────────────────────────

export type HeaderStatsItem = {
  label: string;
  value: string;
};

export type ScaleBarStop = {
  offset: number;
  color: string;
};

export type ScaleBarModel = {
  label: string;
  domain: [number, number];
  stops: ScaleBarStop[];
};

export type SizeScaleModel = {
  label: string;
  samples: Array<{ xg: number; size: number }>;
};

export type LegendGroup = {
  kind: "shape" | "outline" | "outcome" | "colorScale";
  items: Array<{
    key: string;
    label: string;
    color?: string;
  }>;
};

export type ShotMapLegendModel = {
  groups: LegendGroup[];
};

export type ShotMapTooltipModel = {
  rows: Array<{
    key:
      | "playerName"
      | "outcome"
      | "minute"
      | "xg"
      | "bodyPart"
      | "assistType"
      | "shotContext"
      | "isPenalty";
    label: string;
    value: string;
  }>;
};

export type ShotMapShapeKey = "circle" | "hexagon" | "square" | "triangle" | "diamond";

export type ShotMapMarkerModel = {
  shotId: string;
  x: number;
  y: number;
  /** Pitch-space end of shot path when both coordinates are known (e.g. StatsBomb end_location). */
  endX?: number;
  endY?: number;
  visualSize: number;
  sizeValue: number;
  colorValue: number | null;
  fill: string;
  stroke: string;
  fillOpacity: number;
  shapeKey: ShotMapShapeKey;
  outlineKey: "goal" | "shot";
  tooltip: ShotMapTooltipModel;
};

export type ShotMapLayoutModel = {
  order: Array<"headerStats" | "sizeScale" | "scaleBar" | "plot" | "legend">;
  aspectRatio: string;
  minPlotHeightRatio: number;
};

export type ShotMapPreset = "opta" | "statsbomb";

export type ShotMapModel = {
  meta: {
    component: "ShotMap";
    preset: ShotMapPreset;
    empty: boolean;
    accessibleLabel: string;
    hasXg: boolean;
  };
  layout: ShotMapLayoutModel;
  headerStats: {
    items: HeaderStatsItem[];
  } | null;
  sizeScale: SizeScaleModel | null;
  scaleBar: ScaleBarModel | null;
  legend: ShotMapLegendModel | null;
  plot: {
    pitch: {
      crop: "full" | "half";
      attackingDirection: "up" | "down" | "left" | "right";
      side: "attack" | "defend";
    };
    markers: ShotMapMarkerModel[];
  };
  emptyState: {
    message: string;
  } | null;
};

export type ShapeBy = "context" | "bodyPart";
export type XgColorScale = "magma" | "cividis" | "turbo" | "coolwarm";

export type ComputeShotMapInput = {
  shots: readonly Shot[];
  preset?: ShotMapPreset;
  colorScale?: XgColorScale;
  crop?: "full" | "half";
  /**
   * Direction the attacker is facing. `"left"`/`"right"` produce a horizontal
   * pitch, `"up"`/`"down"` a vertical pitch. Defaults to `"up"`.
   */
  attackingDirection?: "up" | "down" | "left" | "right";
  /** Which end of the pitch to show when `crop="half"`. Default `"attack"`. */
  side?: "attack" | "defend";
  sharedScale?: SharedPitchScale;
};

function aspectRatioFor(
  crop: "full" | "half",
  direction: "up" | "down" | "left" | "right",
): string {
  const isVertical = direction === "up" || direction === "down";
  if (crop === "half") {
    return isVertical ? "4:5" : "5:4";
  }
  return isVertical ? "2:3" : "3:2";
}

function shotTrajectoryEnd(
  shot: Shot & { x: number; y: number },
): { endX: number; endY: number } | null {
  const endX = shot.endX;
  const endY = shot.endY;
  if (typeof endX !== "number" || typeof endY !== "number") {
    return null;
  }
  if (!Number.isFinite(endX) || !Number.isFinite(endY)) {
    return null;
  }
  const dx = endX - shot.x;
  const dy = endY - shot.y;
  if (dx * dx + dy * dy < 1e-4) {
    return null;
  }
  return { endX, endY };
}

// ─── Color scales ───────────────────────────────────────────────────

const MAGMA_STOPS: ScaleBarStop[] = [
  { offset: 0, color: "#000004" },
  { offset: 0.2, color: "#3b0f70" },
  { offset: 0.4, color: "#8c2981" },
  { offset: 0.6, color: "#de4968" },
  { offset: 0.8, color: "#fe9f6d" },
  { offset: 1, color: "#fcfdbf" },
];

const CIVIDIS_STOPS: ScaleBarStop[] = [
  { offset: 0, color: "#00224e" },
  { offset: 0.2, color: "#35456c" },
  { offset: 0.4, color: "#666970" },
  { offset: 0.6, color: "#948e77" },
  { offset: 0.8, color: "#c8b866" },
  { offset: 1, color: "#fee838" },
];

const TURBO_STOPS: ScaleBarStop[] = [
  { offset: 0, color: "#30123b" },
  { offset: 0.2, color: "#4665d8" },
  { offset: 0.4, color: "#35b7ff" },
  { offset: 0.6, color: "#8ae04b" },
  { offset: 0.8, color: "#f9c430" },
  { offset: 1, color: "#7a0403" },
];

const COOLWARM_STOPS: ScaleBarStop[] = [
  { offset: 0, color: "#0d3b66" },
  { offset: 0.2, color: "#1b6ca8" },
  { offset: 0.4, color: "#5cc8ff" },
  { offset: 0.6, color: "#f5d76e" },
  { offset: 0.8, color: "#e8723a" },
  { offset: 1, color: "#7a0403" },
];

const COLOR_SCALE_STOPS: Record<XgColorScale, ScaleBarStop[]> = {
  magma: MAGMA_STOPS,
  cividis: CIVIDIS_STOPS,
  turbo: TURBO_STOPS,
  coolwarm: COOLWARM_STOPS,
};

const XG_COLOR_DOMAIN: [number, number] = [0, 1];

function clampProbability(value: number): number {
  return Math.max(XG_COLOR_DOMAIN[0], Math.min(XG_COLOR_DOMAIN[1], value));
}

// ─── Formatters ─────────────────────────────────────────────────────

function formatStatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatOutcome(outcome: Shot["outcome"]): string {
  switch (outcome) {
    case "goal":
      return "Goal";
    case "saved":
      return "Saved";
    case "blocked":
      return "Blocked";
    case "off-target":
      return "Off target";
    case "hit-woodwork":
      return "Hit woodwork";
    case "other":
      return "Shot";
  }

  const exhaustiveOutcome: never = outcome;
  return exhaustiveOutcome;
}

function formatBodyPart(bodyPart: Shot["bodyPart"]): string | null {
  switch (bodyPart) {
    case "left-foot":
      return "Left foot";
    case "right-foot":
      return "Right foot";
    case "head":
      return "Head";
    case "other":
      return "Other";
    default:
      return null;
  }
}

// ─── Outcome colors ─────────────────────────────────────────────────

function colorForOutcome(outcome: Shot["outcome"]): string {
  switch (outcome) {
    case "goal":
      return "#e04162";
    case "saved":
      return "#5cc8ff";
    case "blocked":
      return "#f2a93b";
    case "hit-woodwork":
      return "#f58fb0";
    case "off-target":
      return "#8792a8";
    default:
      return "#b8c0cc";
  }
}

// ─── Preset: Opta ───────────────────────────────────────────────────
// Size = xG, fill/hollow = goal vs non-goal, all circles, clean editorial look

function optaShapeKey(): ShotMapShapeKey {
  return "circle";
}

type MarkerSizeRange = {
  fallbackRadius: number;
  minRadius: number;
  maxRadius: number;
};

const MARKER_SIZE_RANGE_BY_PRESET: Record<ShotMapPreset, MarkerSizeRange> = {
  opta: {
    fallbackRadius: 0.7,
    minRadius: 0.7,
    maxRadius: 2.1,
  },
  statsbomb: {
    fallbackRadius: 0.9,
    minRadius: 0.9,
    maxRadius: 2.5,
  },
};

const OPTA_ACCENT = "#e04162";
const OPTA_MUTED = "#8792a8";

function optaMarkerStyle(
  shot: Shot,
  hasXg: boolean,
): { fill: string; stroke: string; fillOpacity: number } {
  const isGoal = shot.outcome === "goal";
  if (isGoal) {
    return { fill: OPTA_ACCENT, stroke: OPTA_ACCENT, fillOpacity: 1 };
  }
  // Non-goals are hollow outlines
  return {
    fill: "transparent",
    stroke: hasXg ? OPTA_ACCENT : OPTA_MUTED,
    fillOpacity: 0,
  };
}

// ─── Preset: StatsBomb ──────────────────────────────────────────────
// Size = xG, color = xG gradient, shape = context+bodyPart, outcome via outline

function contextShapeKey(shot: Shot): ShotMapShapeKey {
  if (shot.context === "direct-free-kick" || shot.context === "penalty") return "square";
  if (shot.context === "from-corner") return "triangle";
  if (shot.bodyPart === "head") return "circle";
  if (shot.bodyPart === "other") return "diamond";
  return "hexagon";
}

function bodyPartShapeKey(shot: Shot): ShotMapShapeKey {
  if (shot.bodyPart === "head") return "circle";
  if (shot.bodyPart === "left-foot") return "triangle";
  if (shot.bodyPart === "right-foot") return "diamond";
  return "hexagon";
}

const SHAPE_BY_FN: Record<ShapeBy, (shot: Shot) => ShotMapShapeKey> = {
  context: contextShapeKey,
  bodyPart: bodyPartShapeKey,
};

function normalizeForDomain(value: number, domain: readonly [number, number]): number {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return clampProbability(value);
  }
  if (max <= min) {
    return 0.5;
  }
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

function areaScaledMarkerRadius(normalized: number, range: MarkerSizeRange): number {
  const minArea = range.minRadius ** 2;
  const maxArea = range.maxRadius ** 2;
  return Math.sqrt(minArea + normalized * (maxArea - minArea));
}

function createMarkerSizeResolver(
  preset: ShotMapPreset,
  sharedSizeDomain: readonly [number, number] | undefined,
): (xg: number | null) => number {
  const range = MARKER_SIZE_RANGE_BY_PRESET[preset];
  return (xg) => {
    if (xg == null || !Number.isFinite(xg)) {
      return range.fallbackRadius;
    }
    const normalized =
      sharedSizeDomain == null
        ? clampProbability(xg)
        : normalizeForDomain(xg, sharedSizeDomain);
    return areaScaledMarkerRadius(normalized, range);
  };
}

function buildSizeScaleSamples(
  sharedSizeDomain: readonly [number, number] | undefined,
): number[] {
  if (sharedSizeDomain == null) {
    return SIZE_SCALE_SAMPLES;
  }

  const [min, max] = sharedSizeDomain;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return SIZE_SCALE_SAMPLES;
  }
  if (max <= min) {
    return [min];
  }

  return [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
}

function statsbombMarkerStyle(
  shot: Shot,
  hasXg: boolean,
  stops: ScaleBarStop[],
): { fill: string; stroke: string; fillOpacity: number } {
  const DARK_OUTLINE = "rgba(0,0,0,0.45)";
  if (!hasXg || shot.xg == null) {
    const color = colorForOutcome(shot.outcome);
    return { fill: color, stroke: DARK_OUTLINE, fillOpacity: 0.85 };
  }
  const color = interpolateStops(stops, clampProbability(shot.xg));
  return {
    fill: color,
    stroke: DARK_OUTLINE,
    fillOpacity: 0.9,
  };
}

// ─── Tooltip ────────────────────────────────────────────────────────

function buildTooltipRows(shot: Shot, hasXg: boolean): ShotMapTooltipModel {
  const rows: ShotMapTooltipModel["rows"] = [
    {
      key: "playerName",
      label: "Player",
      value: shot.playerName ?? "Unknown player",
    },
    {
      key: "outcome",
      label: "Outcome",
      value: formatOutcome(shot.outcome),
    },
    {
      key: "minute",
      label: "Minute",
      value: formatMinute(shot.minute),
    },
  ];

  if (hasXg && hasRealXg(shot)) {
    rows.push({
      key: "xg",
      label: "xG",
      value: shot.xg.toFixed(2),
    });
  }

  const bodyPart = formatBodyPart(shot.bodyPart);
  if (bodyPart) {
    rows.push({
      key: "bodyPart",
      label: "Body part",
      value: bodyPart,
    });
  }

  if (shot.isPenalty) {
    rows.push({
      key: "isPenalty",
      label: "Penalty",
      value: "Yes",
    });
  }

  return { rows };
}

// ─── Legend builders ────────────────────────────────────────────────

function buildOptaLegend(shots: readonly Shot[]): LegendGroup[] {
  const hasGoals = shots.some((s) => s.outcome === "goal");
  const hasNonGoals = shots.some((s) => s.outcome !== "goal");
  const items: LegendGroup["items"] = [];
  if (hasGoals) items.push({ key: "goal", label: "Goal", color: OPTA_ACCENT });
  if (hasNonGoals) items.push({ key: "shot", label: "Shot" });
  return items.length > 0 ? [{ kind: "outline", items }] : [];
}

const CONTEXT_SHAPE_LABELS: Array<{ key: ShotMapShapeKey; label: string }> = [
  { key: "hexagon", label: "Foot" },
  { key: "circle", label: "Header" },
  { key: "square", label: "Set piece" },
  { key: "triangle", label: "Corner" },
  { key: "diamond", label: "Other" },
];

const BODYPART_SHAPE_LABELS: Array<{ key: ShotMapShapeKey; label: string }> = [
  { key: "circle", label: "Head" },
  { key: "triangle", label: "Left foot" },
  { key: "diamond", label: "Right foot" },
  { key: "hexagon", label: "Other" },
];

function buildStatsbombLegend(
  shots: readonly Shot[],
  colorBy: "outcome" | "xg",
  shapeBy: ShapeBy,
): LegendGroup[] {
  const groups: LegendGroup[] = [];

  const shapeFn = SHAPE_BY_FN[shapeBy];
  const shapeLabels =
    shapeBy === "bodyPart" ? BODYPART_SHAPE_LABELS : CONTEXT_SHAPE_LABELS;
  const presentShapes = new Set(shots.map(shapeFn));
  const shapeItems = shapeLabels.filter((s) => presentShapes.has(s.key));
  if (shapeItems.length > 1) {
    groups.push({ kind: "shape", items: shapeItems });
  }

  if (colorBy === "outcome") {
    const outcomeKeys = Array.from(new Set(shots.map((s) => s.outcome)));
    groups.push({
      kind: "outcome",
      items: outcomeKeys.map((outcome) => ({
        key: outcome,
        label: formatOutcome(outcome),
        color: colorForOutcome(outcome),
      })),
    });
  }

  return groups;
}

// ─── Main compute ───────────────────────────────────────────────────

const SIZE_SCALE_SAMPLES = [0.05, 0.15, 0.3, 0.5, 0.8];

/**
 * Compute a renderer-neutral semantic model for the Campos ShotMap.
 *
 * Supports two presets:
 * - **opta** (default): size=xG, filled=goal, hollow=non-goal, all circles
 * - **statsbomb**: size=xG, color=xG gradient, shape=context+bodyPart
 */
export function computeShotMap(input: ComputeShotMapInput): ShotMapModel {
  const preset = input.preset ?? "opta";
  const colorBy = preset === "statsbomb" ? "xg" : "outcome";
  const crop = input.crop ?? "half";
  const attackingDirection = input.attackingDirection ?? "up";
  const side = input.side ?? "attack";
  const sharedSizeDomain = input.sharedScale?.sizeDomain;

  const plottableShots = input.shots.filter(
    (shot): shot is Shot & { x: number; y: number } =>
      Number.isFinite(shot.x) && Number.isFinite(shot.y),
  );
  const goalCount = plottableShots.filter((shot) => shot.outcome === "goal").length;
  const xgShots = plottableShots.filter(
    (shot): shot is Shot & { x: number; y: number; xg: number } => hasRealXg(shot),
  );
  const hasXg = xgShots.length > 0;

  if (plottableShots.length === 0) {
    return {
      meta: {
        component: "ShotMap",
        preset,
        empty: true,
        accessibleLabel: "Shot map: 0 shots, 0 goals",
        hasXg: false,
      },
      layout: {
        order: ["headerStats", "sizeScale", "scaleBar", "plot", "legend"],
        aspectRatio: aspectRatioFor(crop, attackingDirection),
        minPlotHeightRatio: 0.6,
      },
      headerStats: {
        items: [
          { label: "Shots", value: "0" },
          { label: "Goals", value: "0" },
        ],
      },
      sizeScale: null,
      scaleBar: null,
      legend: null,
      plot: { pitch: { crop, attackingDirection, side }, markers: [] },
      emptyState: { message: "No shot data" },
    };
  }

  const xgTotal = d3Sum(xgShots, (s) => s.xg);

  const shapeBy: ShapeBy = "context";
  const scaleName = input.colorScale ?? "magma";
  const stops = COLOR_SCALE_STOPS[scaleName];

  const shapeKeyFn = preset === "opta" ? optaShapeKey : SHAPE_BY_FN[shapeBy];
  const sizeFn = createMarkerSizeResolver(preset, sharedSizeDomain);
  const styleFn =
    preset === "statsbomb"
      ? (shot: Shot, xg: boolean) => statsbombMarkerStyle(shot, xg, stops)
      : optaMarkerStyle;

  const markers = plottableShots.map((shot) => {
    const style = styleFn(shot, hasXg);
    const trajectory = shotTrajectoryEnd(shot);
    return {
      shotId: shot.id,
      x: shot.x,
      y: shot.y,
      ...(trajectory != null ? { endX: trajectory.endX, endY: trajectory.endY } : {}),
      visualSize: hasXg ? sizeFn(shot.xg) : sizeFn(null),
      sizeValue: shot.xg ?? 0,
      colorValue: hasXg && shot.xg != null ? clampProbability(shot.xg) : null,
      fill: style.fill,
      stroke: style.stroke,
      fillOpacity: style.fillOpacity,
      shapeKey: shapeKeyFn(shot),
      outlineKey: shot.outcome === "goal" ? "goal" : "shot",
      tooltip: buildTooltipRows(shot, hasXg),
    } satisfies ShotMapMarkerModel;
  });

  // Z-order: goals render last (on top)
  markers.sort((a, b) => {
    if (a.outlineKey === "goal" && b.outlineKey !== "goal") return 1;
    if (a.outlineKey !== "goal" && b.outlineKey === "goal") return -1;
    return 0;
  });

  let legendGroups: LegendGroup[];
  if (preset === "statsbomb") {
    legendGroups = buildStatsbombLegend(plottableShots, colorBy, shapeBy);
  } else {
    legendGroups = buildOptaLegend(plottableShots);
  }

  const headerItems: HeaderStatsItem[] = [
    { label: "Shots", value: String(plottableShots.length) },
    { label: "Goals", value: String(goalCount) },
  ];
  if (hasXg) {
    headerItems.push({ label: "xG", value: formatStatNumber(xgTotal) });
  }

  // Opta: size scale, no color bar. StatsBomb: color bar when colorBy=xg.
  const showColorBar = preset === "statsbomb" && hasXg;
  const showSizeScale = preset === "opta" && hasXg;

  return {
    meta: {
      component: "ShotMap",
      preset,
      empty: false,
      accessibleLabel: `Shot map: ${plottableShots.length} shots, ${goalCount} goals`,
      hasXg,
    },
    layout: {
      order: ["headerStats", "sizeScale", "scaleBar", "plot", "legend"],
      aspectRatio: aspectRatioFor(crop, attackingDirection),
      minPlotHeightRatio: 0.6,
    },
    headerStats: { items: headerItems },
    sizeScale: showSizeScale
      ? {
          label: "xG",
          samples: buildSizeScaleSamples(sharedSizeDomain).map((xg) => ({
            xg,
            size: sizeFn(xg),
          })),
        }
      : null,
    scaleBar: showColorBar ? { label: "xG", domain: XG_COLOR_DOMAIN, stops } : null,
    legend: legendGroups.length > 0 ? { groups: legendGroups } : null,
    plot: {
      pitch: { crop, attackingDirection, side },
      markers,
    },
    emptyState: null,
  };
}
