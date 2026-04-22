import type { PitchMarkingsConfig } from "@withqwerty/campos-stadia";

export {
  resolvePitchZonePresetEdges,
  ZONE_PRESET_EXPLICIT_EDGES_WARNING,
  zonePresetFullPitchOnlyWarning,
  zonePresetGridOverrideWarning,
  type PitchZonePreset,
  type PitchZonePresetEdges,
  type PitchZonePresetResolution,
  type UniformPitchZonePreset,
} from "./compute/pitch-zone-presets.js";

export function pitchMarkingsForZonePreset(
  preset: "3x3" | "5x3" | "18" | "20" | undefined,
): PitchMarkingsConfig | undefined {
  if (preset === "18" || preset === "20") {
    return { zones: preset };
  }
  return undefined;
}
