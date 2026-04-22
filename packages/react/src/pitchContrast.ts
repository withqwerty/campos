import type { ColorStop, HeatmapColorScale } from "./compute/index.js";
import type { PitchColors } from "@withqwerty/campos-stadia";

import { hexLuminance } from "./colorUtils.js";

type ResolveAutoPitchLineColorsOptions = {
  autoPitchLines: boolean;
  colorScale?: HeatmapColorScale | undefined;
  fallbackIsDark?: boolean;
  stops?: readonly ColorStop[] | undefined;
};

export function isDarkPitchColorScale({
  colorScale,
  fallbackIsDark = false,
  stops,
}: Omit<ResolveAutoPitchLineColorsOptions, "autoPitchLines">): boolean {
  if (stops != null && stops.length > 0) {
    const firstStop = stops[0]?.color;
    if (!firstStop || !firstStop.startsWith("#")) return false;
    return hexLuminance(firstStop) < 0.15;
  }

  if (colorScale == null) {
    return fallbackIsDark;
  }

  return (
    colorScale === "magma" ||
    colorScale === "inferno" ||
    colorScale === "viridis" ||
    colorScale === "custom"
  );
}

export function resolveAutoPitchLineColors(
  userPitchColors: PitchColors | undefined,
  {
    autoPitchLines,
    colorScale,
    fallbackIsDark = false,
    stops,
  }: ResolveAutoPitchLineColorsOptions,
): PitchColors | undefined {
  if (!autoPitchLines || !isDarkPitchColorScale({ colorScale, fallbackIsDark, stops })) {
    return userPitchColors;
  }

  return {
    ...(userPitchColors ?? {}),
    lines: "#ffffffcc",
    markings: "#ffffff66",
  };
}
