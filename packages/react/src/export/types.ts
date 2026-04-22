import type {
  BumpChartGuidesStyle,
  BumpChartLabelsStyle,
  BumpChartLinesStyle,
  BumpChartPointsStyle,
  BumpChartProps,
} from "../BumpChart.js";
import type {
  FormationDualProps,
  FormationMarkerComposition,
  FormationMarkersStyle,
  FormationSingleProps,
  FormationTeamSpec,
} from "../Formation.js";
import type { HeatmapCellsStyle, HeatmapProps } from "../Heatmap.js";
import type { PassFlowProps } from "../PassFlow.js";
import type { PassMapDotStyle, PassMapLineStyle, PassMapProps } from "../PassMap.js";
import type {
  PassNetworkEdgeStyle,
  PassNetworkNodeStyle,
  PassNetworkProps,
} from "../PassNetwork.js";
import type {
  PassSonarProps,
  PassSonarTextStyle,
  PassSonarWedgesStyle,
} from "../PassSonar.js";
import type {
  PizzaChartAreasStyle,
  PizzaChartBadgesStyle,
  PizzaChartGuidesStyle,
  PizzaChartProps,
  PizzaChartTextStyle,
} from "../PizzaChart.js";
import type {
  PercentileBarProps,
  PercentileBadgeStyle,
  PercentileFillStyle,
  PercentileTextStyle,
  PercentileTicksStyle,
  PercentileTrackStyle,
} from "../PercentileSurfaces.js";
import type {
  RadarChartAreasStyle,
  RadarChartGuidesStyle,
  RadarChartProps,
  RadarChartTextStyle,
} from "../RadarChart.js";
import type {
  ScatterPlotGuidesStyle,
  ScatterPlotLabelsStyle,
  ScatterPlotMarkersStyle,
  ScatterPlotProps,
  ScatterPlotRegionsStyle,
} from "../ScatterPlot.js";
import type {
  ShotMapMarkersStyle,
  ShotMapProps,
  ShotTrajectoryStyle,
} from "../ShotMap.js";
import type { StyleValue } from "../styleValue.js";
import type {
  TerritoryCellsStyle,
  TerritoryLabelsStyle,
  TerritoryProps,
} from "../Territory.js";
import type {
  XGTimelineAreasStyle,
  XGTimelineGuidesStyle,
  XGTimelineLinesStyle,
  XGTimelineMarkersStyle,
  XGTimelineProps,
} from "../XGTimeline.js";

export type ExportPreset = "share-card" | "article-inline" | "square" | "story";
export type ExportThemeName = "light" | "dark";
export type ExportBackgroundToken = "canvas" | "surface";

export type ExportBackgroundSpec =
  | {
      kind: "theme";
      token: ExportBackgroundToken;
    }
  | {
      kind: "solid";
      color: string;
    };

type ExportSerializableValue<T> =
  T extends StyleValue<infer TValue, unknown> ? Exclude<TValue, undefined> : never;

type ExportConstantStyleProps<T> = {
  [K in keyof T as ExportSerializableValue<T[K]> extends never
    ? never
    : K]?: ExportSerializableValue<T[K]>;
};

type ExportFormationTeamSpec = Omit<FormationTeamSpec, "substitutes">;

type ExportFormationMarkerLabelsStyle = {
  background?: string;
  color?: string;
};

type ExportFormationMarkerComposition = Omit<
  FormationMarkerComposition,
  "glyph" | "slots"
> & {
  glyph?: "circle" | "shirt";
};

type ExportPizzaCenterContent = { kind: "initials"; label?: string } | null;

export type ExportBumpChartProps = Omit<
  BumpChartProps,
  | "methodologyNotes"
  | "renderEndLabel"
  | "teamLogos"
  | "staticMode"
  | "lines"
  | "points"
  | "labels"
  | "guides"
> & {
  lines?: ExportConstantStyleProps<BumpChartLinesStyle>;
  points?: ExportConstantStyleProps<BumpChartPointsStyle>;
  labels?: ExportConstantStyleProps<BumpChartLabelsStyle>;
  guides?: ExportConstantStyleProps<BumpChartGuidesStyle>;
};

export type ExportPizzaChartProps = Omit<
  PizzaChartProps,
  | "methodologyNotes"
  | "staticMode"
  | "areas"
  | "guides"
  | "text"
  | "badges"
  | "centerContent"
> & {
  centerContent?: ExportPizzaCenterContent;
  areas?: ExportConstantStyleProps<PizzaChartAreasStyle>;
  guides?: ExportConstantStyleProps<PizzaChartGuidesStyle>;
  text?: ExportConstantStyleProps<PizzaChartTextStyle>;
  badges?: ExportConstantStyleProps<PizzaChartBadgesStyle>;
};

type ExportFormationSingleProps = Omit<
  FormationSingleProps,
  | "className"
  | "style"
  | "substitutes"
  | "markers"
  | "markerLabels"
  | "markerBadges"
  | "markerComposition"
> & {
  markers?: ExportConstantStyleProps<FormationMarkersStyle>;
  markerLabels?: ExportFormationMarkerLabelsStyle;
  markerComposition?: ExportFormationMarkerComposition;
};

type ExportFormationDualProps = Omit<
  FormationDualProps,
  | "className"
  | "style"
  | "home"
  | "away"
  | "markers"
  | "markerLabels"
  | "markerBadges"
  | "markerComposition"
> & {
  home: ExportFormationTeamSpec;
  away: ExportFormationTeamSpec;
  markers?: ExportConstantStyleProps<FormationMarkersStyle>;
  markerLabels?: ExportFormationMarkerLabelsStyle;
  markerComposition?: ExportFormationMarkerComposition;
};

export type ExportFormationProps = ExportFormationSingleProps | ExportFormationDualProps;

export type ExportPassNetworkProps = Omit<
  PassNetworkProps,
  "egoHighlight" | "nodeStyle" | "edgeStyle"
> & {
  nodeStyle?: ExportConstantStyleProps<PassNetworkNodeStyle>;
  edgeStyle?: ExportConstantStyleProps<PassNetworkEdgeStyle>;
};

export type ExportTerritoryProps = Omit<
  TerritoryProps,
  "ariaLabel" | "cells" | "labels"
> & {
  cells?: ExportConstantStyleProps<TerritoryCellsStyle>;
  labels?: ExportConstantStyleProps<TerritoryLabelsStyle>;
};

export type ExportShotMapProps = Omit<ShotMapProps, "markers" | "trajectories"> & {
  markers?: ExportConstantStyleProps<ShotMapMarkersStyle>;
  trajectories?: ExportConstantStyleProps<ShotTrajectoryStyle>;
};

export type ExportPassMapProps = Omit<PassMapProps, "lines" | "dots"> & {
  lines?: ExportConstantStyleProps<PassMapLineStyle>;
  dots?: ExportConstantStyleProps<PassMapDotStyle>;
};

/**
 * PassFlow export props — PassFlowProps with the non-serialisable and
 * non-applicable fields stripped:
 *
 * - `arrowColor` narrows to `string` (callbacks cannot be JSON-serialised).
 * - `animate` / `filterTransition` are dropped — the static SVG export
 *   pipeline rasterises to PNG/PDF where CSS animations are meaningless.
 * - `showHoverDestinations` / `hoverDestinationColor` are dropped — there's
 *   no hover in a static export, and enabling `showHoverDestinations` in
 *   compute allocates per-pass destination objects with no payoff.
 *
 * Using `Omit<PassFlowProps, …>` (rather than `Pick`) keeps this type
 * auto-inherited when new export-relevant props land on `PassFlowProps`.
 */
export type ExportPassFlowProps = Omit<
  PassFlowProps,
  | "arrowColor"
  | "animate"
  | "filterTransition"
  | "showHoverDestinations"
  | "hoverDestinationColor"
> & {
  /** Scalar only — callbacks cannot be JSON-serialised for export. */
  arrowColor?: string;
};

export type ExportHeatmapProps = Omit<HeatmapProps, "cells"> & {
  cells?: ExportConstantStyleProps<HeatmapCellsStyle>;
};

export type ExportScatterPlotProps = Omit<
  ScatterPlotProps<Record<string, unknown>>,
  | "methodologyNotes"
  | "staticMode"
  | "markers"
  | "regionStyle"
  | "guideStyle"
  | "labelStyle"
> & {
  markers?: ExportConstantStyleProps<ScatterPlotMarkersStyle<Record<string, unknown>>>;
  regionStyle?: ExportConstantStyleProps<ScatterPlotRegionsStyle>;
  guideStyle?: ExportConstantStyleProps<ScatterPlotGuidesStyle>;
  labelStyle?: ExportConstantStyleProps<ScatterPlotLabelsStyle>;
};

export type ExportXGTimelineProps = Omit<
  XGTimelineProps,
  "methodologyNotes" | "showCrosshair" | "markers" | "lines" | "guides" | "areas"
> & {
  markers?: ExportConstantStyleProps<XGTimelineMarkersStyle>;
  lines?: ExportConstantStyleProps<XGTimelineLinesStyle>;
  guides?: ExportConstantStyleProps<XGTimelineGuidesStyle>;
  areas?: ExportConstantStyleProps<XGTimelineAreasStyle>;
};

export type ExportRadarChartProps = Omit<
  RadarChartProps,
  "methodologyNotes" | "areas" | "guides" | "text"
> & {
  areas?: ExportConstantStyleProps<RadarChartAreasStyle>;
  guides?: ExportConstantStyleProps<RadarChartGuidesStyle>;
  text?: ExportConstantStyleProps<RadarChartTextStyle>;
};

export type ExportPercentileBarProps = Omit<
  PercentileBarProps,
  "track" | "fill" | "text" | "ticks" | "badges" | "onWarnings" | "recipe"
> & {
  track?: ExportConstantStyleProps<PercentileTrackStyle>;
  fill?: ExportConstantStyleProps<PercentileFillStyle>;
  text?: ExportConstantStyleProps<PercentileTextStyle>;
  ticks?: ExportConstantStyleProps<PercentileTicksStyle>;
  badges?: ExportConstantStyleProps<PercentileBadgeStyle>;
};

export type ExportPassSonarProps = Omit<
  PassSonarProps,
  "methodologyNotes" | "wedges" | "text"
> & {
  wedges?: ExportConstantStyleProps<PassSonarWedgesStyle>;
  text?: ExportConstantStyleProps<PassSonarTextStyle>;
};

export type ExportChartSpec =
  | {
      kind: "bump-chart";
      props: ExportBumpChartProps;
    }
  | {
      kind: "pizza-chart";
      props: ExportPizzaChartProps;
    }
  | {
      kind: "formation";
      props: ExportFormationProps;
    }
  | {
      kind: "pass-network";
      props: ExportPassNetworkProps;
    }
  | {
      kind: "territory";
      props: ExportTerritoryProps;
    }
  | {
      kind: "shot-map";
      props: ExportShotMapProps;
    }
  | {
      kind: "pass-map";
      props: ExportPassMapProps;
    }
  | {
      kind: "pass-flow";
      props: ExportPassFlowProps;
    }
  | {
      kind: "heatmap";
      props: ExportHeatmapProps;
    }
  | {
      kind: "scatter-plot";
      props: ExportScatterPlotProps;
    }
  | {
      kind: "xg-timeline";
      props: ExportXGTimelineProps;
    }
  | {
      kind: "radar-chart";
      props: ExportRadarChartProps;
    }
  | {
      kind: "percentile-bar";
      props: ExportPercentileBarProps;
    }
  | {
      kind: "pass-sonar";
      props: ExportPassSonarProps;
    };

export type ExportFrameSpec = {
  version: 1;
  width: number;
  height: number;
  preset: ExportPreset;
  theme: ExportThemeName;
  padding: number;
  background: ExportBackgroundSpec;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
  chart: ExportChartSpec;
};

export type CreateExportFrameSpecInput = Partial<Omit<ExportFrameSpec, "chart">> & {
  chart: ExportChartSpec;
};
