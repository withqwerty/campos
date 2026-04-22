import type { ComputePassMapInput } from "../src/compute/index.js";
import type { Shot } from "@withqwerty/campos-schema";

import type {
  ExportFormationProps,
  ExportPassMapProps,
  ExportPizzaChartProps,
  ExportShotMapProps,
} from "../src/index.js";

const shots: Shot[] = [];
const passes: ComputePassMapInput["passes"] = [];

const validShotMap: ExportShotMapProps = {
  shots,
  markers: { fill: "#d33", size: 6 },
  trajectories: { stroke: "#d33", strokeDasharray: "4 3" },
};

const validPassMap: ExportPassMapProps = {
  passes,
  lines: { stroke: "#2563eb", strokeWidth: 0.7 },
  dots: { fill: "#2563eb", radius: 1.2 },
};

const validFormation: ExportFormationProps = {
  formation: "4-3-3",
  markers: { glyphKind: "shirt", fill: "#ef4444" },
  markerLabels: { background: "#111827", color: "#ffffff" },
  markerComposition: { glyph: "circle" },
};

const validPizza: ExportPizzaChartProps = {
  rows: [],
  centerContent: { kind: "initials", label: "RW" },
};

const invalidShotMapCallback: ExportShotMapProps = {
  shots,
  trajectories: {
    // @ts-expect-error ExportFrameSpec only supports constant style values.
    stroke: () => "#d33",
  },
};

const invalidPassMapMap: ExportPassMapProps = {
  passes,
  lines: {
    // @ts-expect-error ExportFrameSpec rejects mapped style values.
    stroke: {
      by: () => "complete",
      values: { complete: "#2563eb" },
    },
  },
};

const invalidFormationNameFormat: ExportFormationProps = {
  formation: "4-3-3",
  markerLabels: {
    // @ts-expect-error Formation export does not support callback label formatting.
    nameFormat: "surname",
  },
};

const invalidFormationPhotoGlyph: ExportFormationProps = {
  formation: "4-3-3",
  markerComposition: {
    // @ts-expect-error Formation export only supports non-photo glyph presets.
    glyph: "photo",
  },
};

const invalidPizzaCenterImage: ExportPizzaChartProps = {
  rows: [],
  centerContent: {
    // @ts-expect-error Pizza export excludes image/crest center content.
    kind: "crest",
    src: "https://example.com/crest.png",
  },
};

void [
  validShotMap,
  validPassMap,
  validFormation,
  validPizza,
  invalidShotMapCallback,
  invalidPassMapMap,
  invalidFormationNameFormat,
  invalidFormationPhotoGlyph,
  invalidPizzaCenterImage,
];
