import type { ShotEvent } from "@withqwerty/campos-schema";

import type { GoalMouthShotLayerMarkersStyle } from "./primitives/index.js";

export const DEFAULT_GOAL_MOUTH_PSXG_PALETTE = [
  "#f6efef",
  "#edd8d8",
  "#e3bbbb",
  "#d59696",
  "#c16c6c",
  "#ab4545",
  "#920b0b",
] as const;

export type GoalMouthPsxgMarkerOptions = {
  palette?: readonly string[];
  goalShape?: "diamond" | "circle";
  nonGoalShape?: "circle" | "square";
  goalStroke?: string;
  nonGoalStroke?: string;
  goalStrokeWidth?: number;
  nonGoalStrokeWidth?: number;
  goalBaseSize?: number;
  nonGoalBaseSize?: number;
  sizeScale?: number;
  nonGoalScaleMultiplier?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function goalMouthPsxgColor(
  xgot: number | null | undefined,
  palette: readonly string[] = DEFAULT_GOAL_MOUTH_PSXG_PALETTE,
): string {
  const resolvedPalette = palette.length > 0 ? palette : DEFAULT_GOAL_MOUTH_PSXG_PALETTE;
  const value = clamp(xgot ?? 0, 0, 1);
  const index = Math.round(value * (resolvedPalette.length - 1));
  return resolvedPalette[index] ?? resolvedPalette[0] ?? "#d59696";
}

export function goalMouthPsxgMarkerSize(
  shot: ShotEvent,
  {
    goalBaseSize = 0.23,
    nonGoalBaseSize = 0.16,
    sizeScale = 0.09,
    nonGoalScaleMultiplier = 0.78,
  }: Omit<
    GoalMouthPsxgMarkerOptions,
    | "palette"
    | "goalShape"
    | "nonGoalShape"
    | "goalStroke"
    | "nonGoalStroke"
    | "goalStrokeWidth"
    | "nonGoalStrokeWidth"
  > = {},
): number {
  const base = shot.outcome === "goal" ? goalBaseSize : nonGoalBaseSize;
  const rawSize = base + clamp(shot.xgot ?? 0, 0, 1) * sizeScale;
  return shot.outcome === "goal" ? rawSize : rawSize * nonGoalScaleMultiplier;
}

export function createGoalMouthPsxgMarkers({
  palette = DEFAULT_GOAL_MOUTH_PSXG_PALETTE,
  goalShape = "diamond",
  nonGoalShape = "circle",
  goalStroke = "#f3c515",
  nonGoalStroke = "#d8d0d0",
  goalStrokeWidth = 0.06,
  nonGoalStrokeWidth = 0.04,
  ...sizeOptions
}: GoalMouthPsxgMarkerOptions = {}): GoalMouthShotLayerMarkersStyle {
  return {
    shape: ({ shot }) => (shot.outcome === "goal" ? goalShape : nonGoalShape),
    fill: ({ shot }) => goalMouthPsxgColor(shot.xgot, palette),
    stroke: ({ shot }) => (shot.outcome === "goal" ? goalStroke : nonGoalStroke),
    strokeWidth: ({ shot }) =>
      shot.outcome === "goal" ? goalStrokeWidth : nonGoalStrokeWidth,
    size: ({ shot }) => goalMouthPsxgMarkerSize(shot, sizeOptions),
  };
}

// ---------------------------------------------------------------------------
// Outcome-coloured preset (Opta editorial style)
// ---------------------------------------------------------------------------

/**
 * Per-outcome fill palette used by the "save vs goal" editorial preset
 * (e.g. Opta Analyst / The Analyst goal-mouth charts). Keys are a narrow
 * subset of {@link ShotEvent.outcome} values that matter when rendering
 * on-target placement; consumers may override any or all of them.
 */
export type GoalMouthOutcomePalette = {
  /** Colour for shots with `outcome === "goal"`. */
  goal?: string;
  /** Colour for shots with `outcome === "saved"` (including stopped shots). */
  save?: string;
  /** Colour for `outcome === "hit-woodwork"` shots, when rendered. */
  woodwork?: string;
  /** Fallback colour for any other outcome left in the dataset. */
  other?: string;
};

export const DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE: Required<GoalMouthOutcomePalette> = {
  goal: "#e2525d",
  save: "#8d86b3",
  woodwork: "#c99b5d",
  other: "#9aa0a6",
} as const;

export type GoalMouthOutcomeMarkerOptions = {
  /** Per-outcome fill colours. */
  palette?: GoalMouthOutcomePalette;
  /** Marker fill opacity. Low values help overlapping markers blend. Default `0.55`. */
  fillOpacity?: number;
  /** Marker stroke colour. Default `"none"` (no stroke). */
  stroke?: string;
  /** Marker stroke width in SVG user units. Default `0`. */
  strokeWidth?: number;
  /** Minimum marker radius when `shot.xgot` is 0 (or missing). Default `0.08`. */
  minSize?: number;
  /** Maximum marker radius when `shot.xgot` matches `domainMax`. Default `0.34`. */
  maxSize?: number;
  /** xGOT value mapped to `maxSize`. Values above are clamped. Default `1`. */
  domainMax?: number;
  /** xGOT value mapped to `minSize`. Values below are clamped. Default `0`. */
  domainMin?: number;
};

/**
 * Scale an xGOT value to a marker radius in goal-mouth user units.
 *
 * Linear between `domainMin..domainMax` -> `minSize..maxSize`. Clamped at both
 * ends. Missing xGOT resolves to `minSize`.
 */
export function scaleGoalMouthMarkerSize(
  xgot: number | null | undefined,
  {
    minSize = 0.08,
    maxSize = 0.34,
    domainMin = 0,
    domainMax = 1,
  }: Pick<
    GoalMouthOutcomeMarkerOptions,
    "minSize" | "maxSize" | "domainMin" | "domainMax"
  > = {},
): number {
  if (domainMax <= domainMin) return minSize;
  const clamped = clamp(xgot ?? 0, domainMin, domainMax);
  const t = (clamped - domainMin) / (domainMax - domainMin);
  return minSize + t * (maxSize - minSize);
}

/**
 * Resolve the outcome colour for a shot, merging caller overrides over the
 * default Opta-editorial palette. Exported for legend rendering.
 */
export function goalMouthOutcomeColor(
  outcome: ShotEvent["outcome"],
  palette: GoalMouthOutcomePalette = {},
): string {
  const merged = { ...DEFAULT_GOAL_MOUTH_OUTCOME_PALETTE, ...palette };
  switch (outcome) {
    case "goal":
      return merged.goal;
    case "saved":
    case "blocked":
      return merged.save;
    case "hit-woodwork":
      return merged.woodwork;
    default:
      return merged.other;
  }
}

/**
 * Marker preset for the "save vs goal" editorial goal-mouth style popularised
 * by Opta Analyst / The Analyst: outcome encodes fill colour, xGOT encodes
 * marker radius, all markers are circles with low fill opacity so overlapping
 * shots blend softly.
 *
 * Drop into `<GoalMouthShotChart markers={...} />` or pass directly to
 * `GoalMouthShotLayer`.
 */
export function createGoalMouthOutcomeMarkers({
  palette,
  fillOpacity = 0.55,
  stroke = "none",
  strokeWidth = 0,
  ...sizeOptions
}: GoalMouthOutcomeMarkerOptions = {}): GoalMouthShotLayerMarkersStyle {
  return {
    shape: () => "circle",
    fill: ({ shot }) => goalMouthOutcomeColor(shot.outcome, palette),
    fillOpacity: () => fillOpacity,
    stroke: () => stroke,
    strokeWidth: () => strokeWidth,
    size: ({ shot }) => scaleGoalMouthMarkerSize(shot.xgot, sizeOptions),
  };
}
