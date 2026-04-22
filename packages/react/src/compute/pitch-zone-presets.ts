import { zoneEdgesInCampos, type ZoneLayout } from "@withqwerty/campos-stadia";

import { uniformEdges } from "./edges.js";

export type UniformPitchZonePreset = "3x3" | "5x3";
export type PitchZonePreset = UniformPitchZonePreset | ZoneLayout;

export type PitchZonePresetEdges = {
  xEdges: readonly number[];
  yEdges: readonly number[];
  columns: number;
  rows: number;
};

export type PitchZonePresetResolution =
  | (PitchZonePresetEdges & { warnings: string[] })
  | {
      xEdges?: undefined;
      yEdges?: undefined;
      columns?: undefined;
      rows?: undefined;
      warnings: string[];
    };

const FULL_PITCH_THIRDS_Y = Object.freeze(uniformEdges(3, 0, 100));

const UNIFORM_PRESET_EDGES: Record<
  "full" | "half",
  Record<UniformPitchZonePreset, PitchZonePresetEdges>
> = {
  full: {
    "3x3": {
      xEdges: Object.freeze(uniformEdges(3, 0, 100)),
      yEdges: FULL_PITCH_THIRDS_Y,
      columns: 3,
      rows: 3,
    },
    "5x3": {
      xEdges: Object.freeze(uniformEdges(5, 0, 100)),
      yEdges: FULL_PITCH_THIRDS_Y,
      columns: 5,
      rows: 3,
    },
  },
  half: {
    "3x3": {
      xEdges: Object.freeze(uniformEdges(3, 50, 100)),
      yEdges: FULL_PITCH_THIRDS_Y,
      columns: 3,
      rows: 3,
    },
    "5x3": {
      xEdges: Object.freeze(uniformEdges(5, 50, 100)),
      yEdges: FULL_PITCH_THIRDS_Y,
      columns: 5,
      rows: 3,
    },
  },
};

export const ZONE_PRESET_EXPLICIT_EDGES_WARNING =
  "zonePreset supplied with xEdges/yEdges — explicit edges win; zonePreset is ignored.";

export function zonePresetGridOverrideWarning(gridLabel: "grid" | "gridX/gridY") {
  return gridLabel === "grid"
    ? "Both zonePreset and grid supplied — zonePreset wins; grid is ignored."
    : "Both zonePreset and gridX/gridY supplied — zonePreset wins; gridX/gridY are ignored.";
}

export function zonePresetFullPitchOnlyWarning(preset: ZoneLayout) {
  return `zonePreset "${preset}" is full-pitch only and cannot be used with crop="half"; zonePreset is ignored.`;
}

function isTacticalZonePreset(preset: PitchZonePreset): preset is ZoneLayout {
  return preset === "18" || preset === "20";
}

export function resolvePitchZonePresetEdges(
  preset: PitchZonePreset,
  crop: "full" | "half" = "full",
): PitchZonePresetResolution {
  if (!isTacticalZonePreset(preset)) {
    return { ...UNIFORM_PRESET_EDGES[crop][preset], warnings: [] };
  }

  if (crop === "half") {
    return { warnings: [zonePresetFullPitchOnlyWarning(preset)] };
  }

  const { xEdges, yEdges } = zoneEdgesInCampos(preset);
  return {
    xEdges,
    yEdges,
    columns: xEdges.length - 1,
    rows: yEdges.length - 1,
    warnings: [],
  };
}
