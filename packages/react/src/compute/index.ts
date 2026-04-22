export { interpolateStops } from "./color.js";
export type { ColorStop } from "./color.js";
export { polarToScreen, roundSvg, wedgePath } from "./wedge-geometry.js";
export { resolveColorStops } from "./color-scales.js";
export {
  resolvePitchZonePresetEdges,
  ZONE_PRESET_EXPLICIT_EDGES_WARNING,
  zonePresetFullPitchOnlyWarning,
  zonePresetGridOverrideWarning,
} from "./pitch-zone-presets.js";
export type {
  PitchZonePreset,
  PitchZonePresetEdges,
  PitchZonePresetResolution,
  UniformPitchZonePreset,
} from "./pitch-zone-presets.js";
export {
  computeSharedPitchScale,
  type SharedPitchScale,
  type SharedPitchScaleAccessors,
} from "./shared-pitch-scale.js";

export { computePassMap } from "./pass-map.js";
export type {
  ComputePassMapInput,
  PassMapLayoutModel,
  PassMapLegendItem,
  PassMapLegendModel,
  PassMapMarkerModel,
  PassMapModel,
  PassMapTooltipModel,
} from "./pass-map.js";

export { computePassFlow, InvalidEdgesError } from "./pass-flow.js";
export type {
  ComputePassFlowInput,
  PassFlowArrowLengthMode,
  PassFlowBinModel,
  PassFlowColorScale,
  PassFlowCompletionFilter,
  PassFlowDirectionFilter,
  PassFlowLegendModel,
  PassFlowLowDispersionGlyph,
  PassFlowModel,
  PassFlowTooltipModel,
  PassFlowValueMode,
} from "./pass-flow.js";

export { circularMean } from "./circular.js";
export type { CircularInput, CircularMeanResult } from "./circular.js";

export { computePassNetwork } from "./pass-network.js";
export type {
  ComputePassNetworkInput,
  PassNetworkColorBy,
  PassNetworkEdge,
  PassNetworkLayoutModel,
  PassNetworkLegendColorRow,
  PassNetworkLegendModel,
  PassNetworkLegendRow,
  PassNetworkLegendSizeRow,
  PassNetworkLegendWidthRow,
  PassNetworkModel,
  PassNetworkNode,
  PassNetworkRenderedEdge,
  PassNetworkRenderedNode,
  PassNetworkTooltipModel,
  PassNetworkTooltipRow,
} from "./pass-network.js";

export { aggregatePassNetwork } from "./aggregate-pass-network.js";
export type {
  AggregatePassNetworkOptions,
  AggregatePassNetworkResult,
  PassNetworkSubstitution,
  PassNetworkTimeWindow,
} from "./aggregate-pass-network.js";

export {
  combinePassNetworks,
  compressPassNetwork,
  deriveInitials,
  inferRecipientsFromNextPass,
} from "./pass-network-transforms.js";
export type {
  CompressPassNetworkOptions,
  CompressSide,
  InferRecipientsOptions,
} from "./pass-network-transforms.js";

export {
  assignAngularBin,
  bearingLabel,
  computePassSonar,
  computeSharedScaleMax,
  DEFAULT_PASS_SONAR_BIN_COUNT,
  DEFAULT_PASS_SONAR_DISTANCE_CLIP,
  DEFAULT_PASS_SONAR_SERIES_COLORS,
  formatPassSonarWarning,
} from "./pass-sonar.js";
export type {
  ComputePassSonarInput,
  PassSonarBinCount,
  PassSonarBinLabel,
  PassSonarLegendModel,
  PassSonarLegendRow,
  PassSonarLengthBy,
  PassSonarModel,
  PassSonarSummaryModel,
  PassSonarWarning,
  PassSonarWedgeModel,
  SharedScaleMetric,
} from "./pass-sonar.js";

export { computeShotMap } from "./shot-map.js";
export type {
  ComputeShotMapInput,
  HeaderStatsItem,
  LegendGroup,
  ScaleBarModel,
  ScaleBarStop,
  ShotMapLayoutModel,
  ShotMapLegendModel,
  ShotMapMarkerModel,
  ShotMapModel,
  ShotMapPreset,
  ShotMapShapeKey,
  ShotMapTooltipModel,
  ShapeBy,
  SizeScaleModel,
  XgColorScale,
} from "./shot-map.js";

export { computeHeatmap } from "./heatmap.js";
export type {
  ComputeHeatmapInput,
  HeatmapCell,
  HeatmapColorScale,
  HeatmapEvent,
  HeatmapModel,
  HeatmapValueMode,
} from "./heatmap.js";

export { computeTerritory } from "./territory.js";
export type {
  ComputeTerritoryInput,
  TerritoryCell,
  TerritoryEvent,
  TerritoryGrid,
  TerritoryModel,
  TerritoryZonePreset,
} from "./territory.js";

export { computeScatterPlot } from "./scatter-plot.js";
export type {
  ComputeScatterPlotInput,
  ScatterPlotAxisModel,
  ScatterPlotGhostConfig,
  ScatterPlotGuideInput,
  ScatterPlotLegendItem,
  ScatterPlotLegendModel,
  ScatterPlotMarkerModel,
  ScatterPlotModel,
  ScatterPlotReferenceLineModel,
  ScatterPlotTooltipModel,
} from "./scatter-plot.js";

export { computeDistributionChart } from "./distribution-chart.js";
export type {
  ComputeDistributionChartInput,
  DistributionBandwidth,
  DistributionChartAxisModel,
  DistributionChartLegendItem,
  DistributionChartMarkerModel,
  DistributionChartModel,
  DistributionChartSeriesModel,
  DistributionDefaultMarker,
  DistributionDensityStats,
  DistributionMarkerSource,
  DistributionSeriesInput,
} from "./distribution-chart.js";

export { computeDistributionComparison } from "./distribution-comparison.js";
export type {
  ComputeDistributionComparisonInput,
  DistributionComparisonModel,
  DistributionComparisonRowInput,
  DistributionComparisonRowModel,
} from "./distribution-comparison.js";

export { computeKDE, kdeGridToRGBA } from "./kde.js";
export type { ComputeKDEInput, KDEEvent, KDEModel } from "./kde.js";

export { computePizzaChart } from "./pizza-chart.js";
export type {
  ComputePizzaChartInput,
  PizzaChartCategoryWashModel,
  PizzaChartCenterContent,
  PizzaChartGridRingModel,
  PizzaChartGridRingStyle,
  PizzaChartLabelModel,
  PizzaChartLegendItem,
  PizzaChartLegendModel,
  PizzaChartModel,
  PizzaChartReferenceArcModel,
  PizzaChartReferenceSetInput,
  PizzaChartReferenceSetModel,
  PizzaChartRow,
  PizzaChartSliceModel,
  PizzaChartSpokeModel,
  PizzaChartTooltipModel,
  PizzaChartValueBadgeModel,
} from "./pizza-chart.js";

export { computeRadarChart } from "./radar-chart.js";
export type {
  ComputeRadarChartInput,
  RadarChartAxisModel,
  RadarChartAxisTickModel,
  RadarChartBandModel,
  RadarChartLegendItem,
  RadarChartLegendModel,
  RadarChartModel,
  RadarChartPolygonModel,
  RadarChartRingModel,
  RadarChartRow,
  RadarChartVertexModel,
} from "./radar-chart.js";

export { computeBumpChart } from "./bump-chart.js";
export type {
  BumpChartAxisModel,
  BumpChartEndLabelModel,
  BumpChartLineModel,
  BumpChartModel,
  BumpChartPointModel,
  BumpChartRow,
  BumpChartStartLabelModel,
  ComputeBumpChartInput,
} from "./bump-chart.js";

export { computeLineChart } from "./line-chart.js";
export type {
  ComputeLineChartInput,
  LineChartAxisModel,
  LineChartEndLabelModel,
  LineChartModel,
  LineChartPoint,
  LineChartPointModel,
  LineChartSeriesInput,
  LineChartSeriesModel,
} from "./line-chart.js";
export type {
  EnvelopeReferenceGeometry,
  EnvelopeSourceSeries,
  LineChartEnvelope,
  LineChartEnvelopeModel,
} from "./envelope.js";
export { computeEnvelopes } from "./envelope.js";
export { clipSegment } from "./liangBarsky.js";

export { computeCometChart } from "./comet-chart.js";
export type {
  CometChartAxisModel,
  CometChartEntityModel,
  CometChartGuideInput,
  CometChartGuideModel,
  CometChartLabelModel,
  CometChartLegendItem,
  CometChartLegendModel,
  CometChartModel,
  CometChartPointModel,
  CometChartTooltipModel,
  CometChartTrailSegmentModel,
  ComputeCometChartInput,
} from "./comet-chart.js";

export { computeXGTimeline } from "./xg-timeline.js";
export type {
  ComputeXGTimelineInput,
  XGTimelineAnnotationModel,
  XGTimelineAreaSegment,
  XGTimelineAxisModel,
  XGTimelineBackgroundBand,
  XGTimelineEndLabelModel,
  XGTimelineGuideModel,
  XGTimelineMarkerModel,
  XGTimelineModel,
  XGTimelineScoreStripSegment,
  XGTimelineStepLineModel,
  XGTimelineStepPoint,
} from "./xg-timeline.js";

export { createLinearScale } from "./scales/index.js";
export { niceTicks } from "./scales/index.js";
export type { NiceTicksResult } from "./scales/index.js";

export {
  parseFormationKey,
  isValidFormationKey,
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
  layoutSingleTeam,
  layoutDualTeam,
  applyOrientationAndCrop,
  deriveFormationLabel,
  isVerticalFormation,
} from "./formation.js";
export type {
  FormationKey,
  FormationPlayer,
  FormationTeamData,
  FormationPositionEntry,
  FormationOrientation,
  FormationCrop,
  FormationHalfSide,
  FormationLayoutOptions,
  RenderedFormationSlot,
  SingleTeamLayoutResult,
  DualTeamLayoutResult,
  FormationLabel,
  FormationLabelStrategy,
  DeriveLabelInput,
} from "./formation.js";

export { optaFormationIdToKey, OPTA_FORMATION_ID_MAP } from "./formation-opta-ids.js";

export { resolvePercentileSurfaceModel } from "./percentile-surface.js";
export type {
  PercentileAccessibleLabel,
  PercentileComparisonSample,
  PercentileMetric,
  PercentileSurfaceGeometry,
  PercentileSurfaceInput,
  PercentileSurfaceInvalidReason,
  PercentileSurfaceModel,
} from "./percentile-surface.js";

export { computeBeeswarm } from "./beeswarm.js";
export type {
  BeeswarmAxisModel,
  BeeswarmDotModel,
  BeeswarmGridlineModel,
  BeeswarmGroupInput,
  BeeswarmGroupModel,
  BeeswarmHighlightPlacement,
  BeeswarmHighlightModel,
  BeeswarmHighlightStyle,
  BeeswarmLabelStrategy,
  BeeswarmLayoutInput,
  BeeswarmLegendModel,
  BeeswarmLegendSwatch,
  BeeswarmMetric,
  BeeswarmModel,
  BeeswarmOrientation,
  BeeswarmPacking,
  BeeswarmPopulationColor,
  BeeswarmReferenceLineInput,
  BeeswarmReferenceLineModel,
  BeeswarmSizeFieldInput,
  BeeswarmValueInput,
  ComputeBeeswarmInput,
} from "./beeswarm.js";
