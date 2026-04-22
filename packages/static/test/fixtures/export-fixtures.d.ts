import type {
  BumpChartRow,
  ComputePassMapInput,
  HeatmapEvent,
  PassNetworkEdge,
  PassNetworkNode,
  PizzaChartRow,
  RadarChartRow,
  TerritoryEvent,
} from "@withqwerty/campos-react";
import type { ExportFrameSpec } from "@withqwerty/campos-react";
import type { Shot } from "@withqwerty/campos-schema";

type CreateExportFrameSpec =
  typeof import("@withqwerty/campos-react").createExportFrameSpec;

export declare const bumpRows: BumpChartRow[];
export declare const pizzaRows: PizzaChartRow[];
export declare const territoryEvents: TerritoryEvent[];
export declare const passNetworkNodes: PassNetworkNode[];
export declare const passNetworkEdges: PassNetworkEdge[];
export declare const shots: Shot[];
export declare const passes: ComputePassMapInput["passes"];
export declare const heatmapEvents: HeatmapEvent[];
export declare const scatterPoints: Array<Record<string, string | number>>;
export declare const radarRows: RadarChartRow[];

export declare function buildGoldenSpecs(
  createSpec: CreateExportFrameSpec,
): Array<{ id: string; spec: ExportFrameSpec }>;

export declare function buildLongTextSpec(
  createSpec: CreateExportFrameSpec,
): ExportFrameSpec;

export declare function buildEmptyStateSpec(
  createSpec: CreateExportFrameSpec,
): ExportFrameSpec;

export declare function buildThemeSpecs(createSpec: CreateExportFrameSpec): {
  light: ExportFrameSpec;
  dark: ExportFrameSpec;
};
