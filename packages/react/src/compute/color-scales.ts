import type { ColorStop } from "./color.js";

// ---------------------------------------------------------------------------
// Named sequential color scales
// Source: matplotlib colormaps, sampled at 5 stops.
// ---------------------------------------------------------------------------

export const MAGMA_STOPS: ColorStop[] = [
  { offset: 0, color: "#140e36" },
  { offset: 0.3, color: "#6a176e" },
  { offset: 0.5, color: "#c23a4b" },
  { offset: 0.7, color: "#f07d2a" },
  { offset: 1, color: "#fbffa4" },
];

export const VIRIDIS_STOPS: ColorStop[] = [
  { offset: 0, color: "#440154" },
  { offset: 0.25, color: "#3b528b" },
  { offset: 0.5, color: "#21918c" },
  { offset: 0.75, color: "#5ec962" },
  { offset: 1, color: "#fde725" },
];

// Source: matplotlib inferno colormap, sampled at 5 stops.
export const INFERNO_STOPS: ColorStop[] = [
  { offset: 0, color: "#000004" },
  { offset: 0.25, color: "#420a68" },
  { offset: 0.5, color: "#932667" },
  { offset: 0.75, color: "#dd513a" },
  { offset: 1, color: "#fcffa4" },
];

export const BLUES_STOPS: ColorStop[] = [
  { offset: 0, color: "#f7fbff" },
  { offset: 0.25, color: "#c6dbef" },
  { offset: 0.5, color: "#6baed6" },
  { offset: 0.75, color: "#2171b5" },
  { offset: 1, color: "#08306b" },
];

export const GREENS_STOPS: ColorStop[] = [
  { offset: 0, color: "#f7fcf5" },
  { offset: 0.25, color: "#c7e9c0" },
  { offset: 0.5, color: "#74c476" },
  { offset: 0.75, color: "#238b45" },
  { offset: 1, color: "#00441b" },
];

export const REDS_STOPS: ColorStop[] = [
  { offset: 0, color: "#fff5f0" },
  { offset: 0.25, color: "#fcbba1" },
  { offset: 0.5, color: "#fb6a4a" },
  { offset: 0.75, color: "#cb181d" },
  { offset: 1, color: "#67000d" },
];

// ColorBrewer RdBu, reversed so high values are red (hot zones).
export const RDBU_STOPS: ColorStop[] = [
  { offset: 0, color: "#2166ac" },
  { offset: 0.25, color: "#92c5de" },
  { offset: 0.5, color: "#f7f7f7" },
  { offset: 0.75, color: "#f4a582" },
  { offset: 1, color: "#b2182b" },
];

/**
 * Red → grey → green diverging ramp. Conventional for football
 * overperformance metrics (xP, xT delta, NPxG delta) — under = red,
 * over = green. Sampled to a neutral mid so the zero tick reads as
 * "average", not "cold".
 */
export const RDYLGN_STOPS: ColorStop[] = [
  { offset: 0, color: "#c53b3b" },
  { offset: 0.25, color: "#e68a6d" },
  { offset: 0.5, color: "#a7a7a7" },
  { offset: 0.75, color: "#6bc48c" },
  { offset: 1, color: "#17a86b" },
];

export const COLOR_SCALES: Record<string, ColorStop[]> = {
  magma: MAGMA_STOPS,
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS,
  blues: BLUES_STOPS,
  greens: GREENS_STOPS,
  reds: REDS_STOPS,
  "sequential-blues": BLUES_STOPS,
  "sequential-reds": REDS_STOPS,
  "diverging-rdbu": RDBU_STOPS,
  "diverging-rdylgn": RDYLGN_STOPS,
};

/**
 * Resolve color stops for a named scale or a custom override.
 * Falls back to magma when the scale name is not recognised.
 */
export function resolveColorStops(
  colorScale: string | undefined,
  colorStops: ColorStop[] | undefined,
): ColorStop[] {
  if (colorScale === "custom" && colorStops != null && colorStops.length > 0) {
    return colorStops;
  }
  return COLOR_SCALES[colorScale ?? "magma"] ?? MAGMA_STOPS;
}
