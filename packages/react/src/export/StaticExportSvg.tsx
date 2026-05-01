import { useId } from "react";

import {
  computeBumpChart,
  computeHeatmap,
  computePassFlow,
  computePassMap,
  computePassNetwork,
  computePizzaChart,
  computeRadarChart,
  computeScatterPlot,
  computeShotMap,
  computeXGTimeline,
} from "../compute/index.js";
import { computeViewBox } from "@withqwerty/campos-stadia";

import { BumpChartStaticSvg } from "../BumpChart.js";
import { FormationStaticSvg } from "../Formation.js";
import { HeatmapStaticSvg } from "../Heatmap.js";
import { PassFlowStaticSvg } from "../PassFlow.js";
import { PassMapStaticSvg } from "../PassMap.js";
import { PassNetworkStaticSvg } from "../PassNetwork.js";
import { PassSonarStaticSvg, resolvePassSonarStaticLegendSpec } from "../PassSonar.js";
import { PizzaChartStaticSvg } from "../PizzaChart.js";
import {
  PERCENTILE_BAR_STATIC_VIEWBOX,
  PercentileBarStaticSvg,
} from "../PercentileSurfaces.js";
import { RadarChartStaticSvg } from "../RadarChart.js";
import { ScatterPlotStaticSvg } from "../ScatterPlot.js";
import { ShotMapStaticSvg } from "../ShotMap.js";
import { TerritoryStaticSvg } from "../Territory.js";
import { XGTimelineStaticSvg } from "../XGTimeline.js";
import { ThemeProvider } from "../ThemeContext.js";
import { DARK_THEME, LIGHT_THEME, type UITheme } from "../theme.js";
import { resolveThemePalette } from "../themePalette.js";
import { resolveExportBackground } from "./background.js";
import { unsupportedExportChartKind } from "./chart-kind.js";
import type { ExportChartSpec, ExportFrameSpec } from "./types.js";

const FONT_FAMILY = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

type LegendItem = {
  key: string;
  label: string;
  color: string;
};

type LegendBlock =
  | {
      kind: "items";
      items: LegendItem[];
    }
  | {
      kind: "scale";
      label: string;
      startLabel: string;
      endLabel: string;
      stops: Array<{ offset: number; color: string }>;
      tickAt?: number;
      tickLabel?: string;
    }
  | {
      kind: "circle-range";
      label: string;
      minLabel: string;
      maxLabel: string;
      color: string;
    }
  | {
      kind: "line-range";
      label: string;
      minLabel: string;
      maxLabel: string;
      color: string;
    }
  | {
      kind: "size-samples";
      label: string;
      samples: Array<{ label: string; radius: number }>;
    };

type HeaderBlock = {
  kind: "stats";
  items: Array<{ label: string; value: string }>;
};

function resolveTheme(themeName: ExportFrameSpec["theme"]): UITheme {
  return themeName === "dark" ? DARK_THEME : LIGHT_THEME;
}

function chartAspectRatio(chart: ExportChartSpec): number {
  switch (chart.kind) {
    case "bump-chart":
      return 640 / 380;
    case "pizza-chart":
      return 1;
    case "formation":
      if ("home" in chart.props) {
        return chart.props.attackingDirection === "right" ? 105 / 68 : 68 / 105;
      }
      if (chart.props.attackingDirection === "right") return 105 / 68;
      return chart.props.crop === "half" ? 68 / 52.5 : 68 / 105;
    case "pass-network":
      return chart.props.attackingDirection === "up" ? 68 / 105 : 105 / 68;
    case "territory":
      if (chart.props.attackingDirection === "right") return 105 / 68;
      return chart.props.crop === "half" ? 68 / 52.5 : 68 / 105;
    case "shot-map":
      return 68 / 52.5;
    case "pass-map": {
      const viewBox = computeViewBox(
        chart.props.crop ?? "full",
        chart.props.attackingDirection ?? "right",
      );
      return viewBox.width / viewBox.height;
    }
    case "pass-flow": {
      const viewBox = computeViewBox(
        chart.props.crop ?? "full",
        chart.props.attackingDirection ?? "right",
      );
      return viewBox.width / viewBox.height;
    }
    case "heatmap": {
      const viewBox = computeViewBox(
        chart.props.crop ?? "full",
        chart.props.attackingDirection ?? "up",
      );
      return viewBox.width / viewBox.height;
    }
    case "scatter-plot":
      return 400 / 320;
    case "xg-timeline":
      return 560 / 320;
    case "radar-chart":
      return 1;
    case "percentile-bar":
      return PERCENTILE_BAR_STATIC_VIEWBOX.width / PERCENTILE_BAR_STATIC_VIEWBOX.height;
    case "pass-sonar":
      return 1;
    default:
      return unsupportedExportChartKind((chart as { kind: string }).kind);
  }
}

function evenlySpacedStops(
  colors: readonly string[],
): Array<{ offset: number; color: string }> {
  if (colors.length <= 1) {
    return [{ offset: 0, color: colors[0] ?? "#94a3b8" }];
  }

  return colors.map((color, index) => ({
    offset: index / (colors.length - 1),
    color,
  }));
}

function resolveHeaderBlocks(chart: ExportChartSpec): HeaderBlock[] {
  if (chart.kind === "pass-map") {
    if (chart.props.showHeaderStats === false) return [];
    const model = computePassMap({
      passes: chart.props.passes,
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
    });
    return model.headerStats != null
      ? [{ kind: "stats", items: model.headerStats.items }]
      : [];
  }

  if (chart.kind === "pass-flow") {
    if (chart.props.showHeaderStats === false) return [];
    const model = computePassFlow({
      passes: chart.props.passes,
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.bins != null ? { bins: chart.props.bins } : {}),
      ...(chart.props.xEdges != null ? { xEdges: chart.props.xEdges } : {}),
      ...(chart.props.yEdges != null ? { yEdges: chart.props.yEdges } : {}),
      ...(chart.props.completionFilter != null
        ? { completionFilter: chart.props.completionFilter }
        : {}),
      ...(chart.props.directionFilter != null
        ? { directionFilter: chart.props.directionFilter }
        : {}),
      ...(chart.props.minMinute != null ? { minMinute: chart.props.minMinute } : {}),
      ...(chart.props.maxMinute != null ? { maxMinute: chart.props.maxMinute } : {}),
      ...(chart.props.periodFilter != null
        ? { periodFilter: chart.props.periodFilter }
        : {}),
      ...(chart.props.valueMode != null ? { valueMode: chart.props.valueMode } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
      ...(chart.props.colorStops != null ? { colorStops: chart.props.colorStops } : {}),
      ...(chart.props.arrowLengthMode != null
        ? { arrowLengthMode: chart.props.arrowLengthMode }
        : {}),
      ...(chart.props.dispersionFloor != null
        ? { dispersionFloor: chart.props.dispersionFloor }
        : {}),
      ...(chart.props.minCountForArrow != null
        ? { minCountForArrow: chart.props.minCountForArrow }
        : {}),
      ...(chart.props.lowDispersionGlyph != null
        ? { lowDispersionGlyph: chart.props.lowDispersionGlyph }
        : {}),
      ...(chart.props.metricLabel != null
        ? { metricLabel: chart.props.metricLabel }
        : {}),
    });
    return model.headerStats != null
      ? [{ kind: "stats", items: model.headerStats.items }]
      : [];
  }

  if (chart.kind === "pass-network") {
    const model = computePassNetwork({
      nodes: chart.props.nodes,
      edges: chart.props.edges,
      ...(chart.props.minEdgePasses != null
        ? { minEdgePasses: chart.props.minEdgePasses }
        : {}),
      ...(chart.props.showLabels != null ? { showLabels: chart.props.showLabels } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.directed != null ? { directed: chart.props.directed } : {}),
      ...(chart.props.collisionPadding != null
        ? { collisionPadding: chart.props.collisionPadding }
        : {}),
    });
    return model.headerStats != null
      ? [{ kind: "stats", items: model.headerStats.items }]
      : [];
  }

  if (chart.kind === "shot-map") {
    if (chart.props.showHeaderStats !== true) return [];
    const model = computeShotMap({
      shots: chart.props.shots,
      ...(chart.props.preset != null ? { preset: chart.props.preset } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.side != null ? { side: chart.props.side } : {}),
      ...(chart.props.sharedScale != null
        ? { sharedScale: chart.props.sharedScale }
        : {}),
    });
    return model.headerStats != null
      ? [{ kind: "stats", items: model.headerStats.items }]
      : [];
  }

  return [];
}

function resolveLegendBlocks(chart: ExportChartSpec, theme: UITheme): LegendBlock[] {
  if (chart.kind === "bump-chart") {
    const model = computeBumpChart({
      rows: chart.props.rows,
      ...(chart.props.highlightTeams != null
        ? { highlightTeams: chart.props.highlightTeams }
        : {}),
      ...(chart.props.interpolation != null
        ? { interpolation: chart.props.interpolation }
        : {}),
      ...(chart.props.showMarkers != null
        ? { showMarkers: chart.props.showMarkers }
        : {}),
      ...(chart.props.showEndLabels != null
        ? { showEndLabels: chart.props.showEndLabels }
        : {}),
      ...(chart.props.showStartLabels != null
        ? { showStartLabels: chart.props.showStartLabels }
        : {}),
      ...(chart.props.showGridLines != null
        ? { showGridLines: chart.props.showGridLines }
        : {}),
      ...(chart.props.rankDomain != null ? { rankDomain: chart.props.rankDomain } : {}),
      ...(chart.props.teamColors != null ? { teamColors: chart.props.teamColors } : {}),
      ...(chart.props.timepointLabel != null
        ? { timepointLabel: chart.props.timepointLabel }
        : {}),
      ...(chart.props.rankLabel != null ? { rankLabel: chart.props.rankLabel } : {}),
      ...(chart.props.markerRadius != null
        ? { markerRadius: chart.props.markerRadius }
        : {}),
      ...(chart.props.backgroundOpacity != null
        ? { backgroundOpacity: chart.props.backgroundOpacity }
        : {}),
    });

    if (chart.props.showEndLabels !== false || model.endLabels.length > 0) {
      return [];
    }

    return [
      {
        kind: "items",
        items: model.lines
          .filter((line) => line.highlighted)
          .map((line) => ({
            key: line.team,
            label: line.teamLabel,
            color: line.color,
          })),
      },
    ];
  }

  if (chart.kind === "pizza-chart") {
    const categoryColors = resolveThemePalette(chart.props.categoryColors, theme);
    const model = computePizzaChart({
      rows: chart.props.rows,
      ...(chart.props.metricOrder != null
        ? { metricOrder: chart.props.metricOrder }
        : {}),
      ...(chart.props.categoryOrder != null
        ? { categoryOrder: chart.props.categoryOrder }
        : {}),
      ...(chart.props.showValueBadges != null
        ? { showValueBadges: chart.props.showValueBadges }
        : {}),
      ...(chart.props.showAxisLabels != null
        ? { showAxisLabels: chart.props.showAxisLabels }
        : {}),
      ...(chart.props.showLegend != null ? { showLegend: chart.props.showLegend } : {}),
      ...(categoryColors != null ? { categoryColors } : {}),
      ...(chart.props.centerContent !== undefined
        ? { centerContent: chart.props.centerContent }
        : {}),
      ...(chart.props.gridRingStep != null
        ? { gridRingStep: chart.props.gridRingStep }
        : {}),
      ...(chart.props.referenceSets != null
        ? { referenceSets: chart.props.referenceSets }
        : {}),
    });

    return model.legend?.items != null
      ? [{ kind: "items", items: model.legend.items }]
      : [];
  }

  if (chart.kind === "formation") {
    if ("legendPlacement" in chart.props && chart.props.legendPlacement === "none") {
      return [];
    }
    if ("home" in chart.props && "away" in chart.props) {
      return [
        {
          kind: "items",
          items: [
            {
              key: "home",
              label: chart.props.home.label ?? "Home",
              color: chart.props.home.color ?? "#e50027",
            },
            {
              key: "away",
              label: chart.props.away.label ?? "Away",
              color: chart.props.away.color ?? "#2563eb",
            },
          ].filter((item) => item.label.length > 0),
        },
      ];
    }

    if (chart.props.teamLabel != null && chart.props.teamLabel.length > 0) {
      return [
        {
          kind: "items",
          items: [
            {
              key: "team",
              label: chart.props.teamLabel,
              color: chart.props.teamColor ?? "#d33",
            },
          ],
        },
      ];
    }

    return [];
  }

  if (chart.kind === "territory") {
    return [];
  }

  if (chart.kind === "pass-network") {
    const model = computePassNetwork({
      nodes: chart.props.nodes,
      edges: chart.props.edges,
      ...(chart.props.minEdgePasses != null
        ? { minEdgePasses: chart.props.minEdgePasses }
        : {}),
      ...(chart.props.showLabels != null ? { showLabels: chart.props.showLabels } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.directed != null ? { directed: chart.props.directed } : {}),
      ...(chart.props.collisionPadding != null
        ? { collisionPadding: chart.props.collisionPadding }
        : {}),
    });

    const blocks: LegendBlock[] = [];
    for (const row of model.legend?.rows ?? []) {
      if (row.kind === "size") {
        blocks.push({
          kind: "circle-range",
          label: row.label,
          minLabel: row.minLabel,
          maxLabel: row.maxLabel,
          color: row.color,
        });
        continue;
      }
      if (row.kind === "width") {
        blocks.push({
          kind: "line-range",
          label: row.label,
          minLabel: row.minLabel,
          maxLabel: row.maxLabel,
          color: row.color,
        });
        continue;
      }
      if (row.mode === "team") {
        blocks.push({
          kind: "items",
          items: [{ key: row.label, label: row.label, color: row.color }],
        });
        continue;
      }
      blocks.push({
        kind: "scale",
        label: row.label,
        startLabel: row.minLabel,
        endLabel: row.maxLabel,
        stops: evenlySpacedStops(row.gradient),
      });
    }

    return blocks;
  }

  if (chart.kind === "shot-map") {
    const model = computeShotMap({
      shots: chart.props.shots,
      ...(chart.props.preset != null ? { preset: chart.props.preset } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.side != null ? { side: chart.props.side } : {}),
      ...(chart.props.sharedScale != null
        ? { sharedScale: chart.props.sharedScale }
        : {}),
    });

    const blocks: LegendBlock[] = [];

    if (chart.props.showSizeScale !== false && model.sizeScale != null) {
      blocks.push({
        kind: "size-samples",
        label: model.sizeScale.label,
        samples: model.sizeScale.samples.map((sample) => ({
          label: sample.xg.toFixed(2),
          radius: Math.max(3, sample.size * 3),
        })),
      });
    }

    if (chart.props.showScaleBar !== false && model.scaleBar != null) {
      blocks.push({
        kind: "scale",
        label: model.scaleBar.label,
        startLabel: model.scaleBar.domain[0].toFixed(2),
        endLabel: model.scaleBar.domain[1].toFixed(2),
        stops: model.scaleBar.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color,
        })),
      });
    }

    if (chart.props.showLegend !== false && model.legend != null) {
      blocks.push({
        kind: "items",
        items: model.legend.groups.flatMap((group) =>
          group.items.map((item) => ({
            key: `${group.kind}-${item.key}`,
            label: item.label,
            color: item.color ?? "#64748b",
          })),
        ),
      });
    }

    return blocks;
  }

  if (chart.kind === "pass-map") {
    if (chart.props.showLegend === false) return [];
    const model = computePassMap({
      passes: chart.props.passes,
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
    });

    return model.legend?.items != null
      ? [
          {
            kind: "items",
            items: model.legend.items.map((item) => ({
              key: item.key,
              label: item.label,
              color: item.color,
            })),
          },
        ]
      : [];
  }

  if (chart.kind === "pass-flow") {
    if (chart.props.showLegend === false) return [];
    const model = computePassFlow({
      passes: chart.props.passes,
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.bins != null ? { bins: chart.props.bins } : {}),
      ...(chart.props.xEdges != null ? { xEdges: chart.props.xEdges } : {}),
      ...(chart.props.yEdges != null ? { yEdges: chart.props.yEdges } : {}),
      ...(chart.props.completionFilter != null
        ? { completionFilter: chart.props.completionFilter }
        : {}),
      ...(chart.props.valueMode != null ? { valueMode: chart.props.valueMode } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
      ...(chart.props.colorStops != null ? { colorStops: chart.props.colorStops } : {}),
      ...(chart.props.metricLabel != null
        ? { metricLabel: chart.props.metricLabel }
        : {}),
    });
    if (!model.legend) return [];
    return [
      {
        kind: "scale",
        label: model.legend.title,
        startLabel: model.legend.domain[0].toString(),
        endLabel: model.legend.domain[1].toString(),
        stops: model.legend.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color,
        })),
        ...(model.meta.valueMode === "relative-frequency" && model.legend.domain[1] > 0
          ? {
              tickAt: 1 / model.legend.domain[1],
              tickLabel: "1",
            }
          : {}),
      },
    ];
  }

  if (chart.kind === "heatmap") {
    if (chart.props.showScaleBar === false) return [];
    const model = computeHeatmap({
      events: chart.props.events,
      ...(chart.props.gridX != null ? { gridX: chart.props.gridX } : {}),
      ...(chart.props.gridY != null ? { gridY: chart.props.gridY } : {}),
      ...(chart.props.xEdges != null ? { xEdges: chart.props.xEdges } : {}),
      ...(chart.props.yEdges != null ? { yEdges: chart.props.yEdges } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
      ...(chart.props.colorStops != null ? { colorStops: chart.props.colorStops } : {}),
      ...(chart.props.attackingDirection != null
        ? { attackingDirection: chart.props.attackingDirection }
        : {}),
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.metricLabel != null
        ? { metricLabel: chart.props.metricLabel }
        : {}),
      ...(chart.props.valueMode != null ? { valueMode: chart.props.valueMode } : {}),
    });

    if (!model.scaleBar) return [];
    return [
      {
        kind: "scale",
        label: model.scaleBar.label,
        startLabel: model.scaleBar.domain[0].toString(),
        endLabel: model.scaleBar.domain[1].toString(),
        stops: model.scaleBar.stops.map((stop) => ({
          offset: stop.offset,
          color: stop.color,
        })),
      },
    ];
  }

  if (chart.kind === "scatter-plot") {
    const model = computeScatterPlot(chart.props);
    const items = model.legends.flatMap((legend) => {
      if (legend.kind === "categorical") {
        return legend.items.map((item) => ({
          key: `${legend.title}-${item.key}`,
          label: item.label,
          color: item.color ?? "#64748b",
        }));
      }

      if (legend.kind === "continuous") {
        const first = legend.items[0];
        const last = legend.items[legend.items.length - 1];
        return [
          {
            key: `${legend.title}-min`,
            label: first?.label ?? "Low",
            color: first?.color ?? "#94a3b8",
          },
          {
            key: `${legend.title}-max`,
            label: last?.label ?? "High",
            color: last?.color ?? "#0f172a",
          },
        ];
      }

      return legend.items.map((item) => ({
        key: `${legend.title}-${item.key}`,
        label: item.label,
        color: "#4665d8",
      }));
    });

    return items.length > 0 ? [{ kind: "items", items }] : [];
  }

  if (chart.kind === "xg-timeline") {
    const model = computeXGTimeline({
      shots: chart.props.shots,
      homeTeam: chart.props.homeTeam,
      awayTeam: chart.props.awayTeam,
      ...(chart.props.layout != null ? { layout: chart.props.layout } : {}),
      ...(chart.props.showAreaFill != null
        ? { showAreaFill: chart.props.showAreaFill }
        : {}),
      ...(chart.props.showScoreStrip != null
        ? { showScoreStrip: chart.props.showScoreStrip }
        : {}),
      ...(chart.props.showShotDots != null
        ? { showShotDots: chart.props.showShotDots }
        : {}),
      showCrosshair: false,
      ...(chart.props.teamColors != null ? { teamColors: chart.props.teamColors } : {}),
    });

    return [
      {
        kind: "items",
        items: model.endLabels.map((label) => ({
          key: label.teamId,
          label: label.text,
          color: label.color,
        })),
      },
    ];
  }

  if (chart.kind === "percentile-bar") {
    return [];
  }

  if (chart.kind === "pass-sonar") {
    const legend = resolvePassSonarStaticLegendSpec(chart.props, theme);
    if (legend == null) return [];
    if (legend.kind === "items") {
      return [{ kind: "items", items: legend.items }];
    }
    return [
      {
        kind: "scale",
        label: legend.label,
        startLabel: legend.startLabel,
        endLabel: legend.endLabel,
        stops: evenlySpacedStops(legend.colors),
        ...(legend.tickAt != null ? { tickAt: legend.tickAt } : {}),
        ...(legend.tickLabel != null ? { tickLabel: legend.tickLabel } : {}),
      },
    ];
  }

  const ringColors = resolveThemePalette(chart.props.ringColors, theme);
  const categoryColors = resolveThemePalette(chart.props.categoryColors, theme);
  const model = computeRadarChart({
    ...(chart.props.rows != null ? { rows: chart.props.rows } : {}),
    ...(chart.props.series != null ? { series: chart.props.series } : {}),
    ...(chart.props.metricOrder != null ? { metricOrder: chart.props.metricOrder } : {}),
    ...(chart.props.categoryOrder != null
      ? { categoryOrder: chart.props.categoryOrder }
      : {}),
    ...(chart.props.valueMode != null ? { valueMode: chart.props.valueMode } : {}),
    ...(chart.props.showLegend != null ? { showLegend: chart.props.showLegend } : {}),
    ...(chart.props.showVertexMarkers != null
      ? { showVertexMarkers: chart.props.showVertexMarkers }
      : {}),
    ...(chart.props.showAxisLabels != null
      ? { showAxisLabels: chart.props.showAxisLabels }
      : {}),
    ...(chart.props.ringStyle != null ? { ringStyle: chart.props.ringStyle } : {}),
    ...(chart.props.ringSteps != null ? { ringSteps: chart.props.ringSteps } : {}),
    ...(chart.props.bandSteps != null ? { bandSteps: chart.props.bandSteps } : {}),
    ...(ringColors != null ? { ringColors } : {}),
    ...(categoryColors != null ? { categoryColors } : {}),
  });

  return model.legend?.items != null
    ? [{ kind: "items", items: model.legend.items }]
    : [];
}

function renderChart(chart: ExportChartSpec, theme: UITheme) {
  switch (chart.kind) {
    case "bump-chart":
      return <BumpChartStaticSvg {...chart.props} theme={theme} />;
    case "pizza-chart":
      return <PizzaChartStaticSvg {...chart.props} theme={theme} />;
    case "formation":
      return <FormationStaticSvg {...chart.props} />;
    case "pass-network":
      return <PassNetworkStaticSvg {...chart.props} theme={theme} />;
    case "territory":
      return <TerritoryStaticSvg {...chart.props} theme={theme} />;
    case "shot-map":
      return <ShotMapStaticSvg {...chart.props} theme={theme} />;
    case "pass-map":
      return <PassMapStaticSvg {...chart.props} theme={theme} />;
    case "pass-flow":
      return <PassFlowStaticSvg {...chart.props} theme={theme} />;
    case "heatmap":
      return <HeatmapStaticSvg {...chart.props} theme={theme} />;
    case "scatter-plot":
      return <ScatterPlotStaticSvg {...chart.props} theme={theme} />;
    case "xg-timeline":
      return <XGTimelineStaticSvg {...chart.props} theme={theme} />;
    case "radar-chart":
      return <RadarChartStaticSvg {...chart.props} theme={theme} />;
    case "percentile-bar":
      return (
        <ThemeProvider value={theme}>
          <PercentileBarStaticSvg {...chart.props} />
        </ThemeProvider>
      );
    case "pass-sonar":
      return <PassSonarStaticSvg {...chart.props} theme={theme} />;
    default:
      return unsupportedExportChartKind((chart as { kind: string }).kind);
  }
}

function SvgLegendItemsRow({
  items,
  x,
  y,
  width,
  theme,
}: {
  items: LegendItem[];
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  if (items.length === 0) return null;

  const gap = 18;
  const itemWidths = items.map((item) => 24 + item.label.length * 7);
  const totalWidth =
    itemWidths.reduce((sum, itemWidth) => sum + itemWidth, 0) + gap * (items.length - 1);
  const startX = x + Math.max(0, (width - totalWidth) / 2);
  const itemPositions = items.map((item, index) => {
    const offset = itemWidths
      .slice(0, index)
      .reduce((sum, itemWidth) => sum + itemWidth + gap, 0);
    return {
      item,
      itemX: startX + offset,
    };
  });

  return (
    <g transform={`translate(0 ${y})`}>
      {itemPositions.map(({ item, itemX }) => {
        return (
          <g key={item.key} transform={`translate(${itemX} 0)`}>
            <rect x={0} y={0} width={10} height={10} rx={2} fill={item.color} />
            <text
              x={16}
              y={9}
              fill={theme.text.secondary}
              fontFamily={FONT_FAMILY}
              fontSize={12}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SvgHeaderStatsBlock({
  block,
  x,
  y,
  width,
  theme,
}: {
  block: HeaderBlock;
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  if (block.items.length === 0) return null;

  const itemWidth = width / block.items.length;

  return (
    <g transform={`translate(0 ${y})`}>
      {block.items.map((item, index) => {
        const itemX = x + itemWidth * index + itemWidth / 2;
        return (
          <g key={`${item.label}-${index}`}>
            <text
              x={itemX}
              y={10}
              textAnchor="middle"
              fill={theme.text.secondary}
              fontFamily={FONT_FAMILY}
              fontSize={11}
              letterSpacing="0.06em"
            >
              {item.label.toUpperCase()}
            </text>
            <text
              x={itemX}
              y={28}
              textAnchor="middle"
              fill={theme.text.primary}
              fontFamily={FONT_FAMILY}
              fontSize={18}
              fontWeight={700}
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SvgScaleLegendBlock({
  block,
  x,
  y,
  width,
  theme,
}: {
  block: Extract<LegendBlock, { kind: "scale" }>;
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  const gradientId = `export-gradient-${useId().replace(/:/g, "")}`;
  const barWidth = Math.min(width, 320);
  const barX = x + (width - barWidth) / 2;

  return (
    <g transform={`translate(0 ${y})`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {block.stops.map((stop, index) => (
            <stop
              key={`${gradientId}-${index}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
            />
          ))}
        </linearGradient>
      </defs>
      <text
        x={barX}
        y={10}
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={11}
        letterSpacing="0.06em"
      >
        {block.label.toUpperCase()}
      </text>
      <text
        x={barX + barWidth}
        y={10}
        textAnchor="end"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={11}
      >
        {block.startLabel} - {block.endLabel}
      </text>
      <rect
        x={barX}
        y={18}
        width={barWidth}
        height={10}
        rx={5}
        fill={`url(#${gradientId})`}
      />
      {block.tickAt != null && block.tickLabel != null ? (
        <g transform={`translate(${barX + barWidth * block.tickAt} 0)`}>
          <line
            x1={0}
            y1={16}
            x2={0}
            y2={30}
            stroke={theme.text.primary}
            strokeWidth={1}
          />
          <text
            x={0}
            y={41}
            textAnchor="middle"
            fill={theme.text.secondary}
            fontFamily={FONT_FAMILY}
            fontSize={10}
          >
            {block.tickLabel}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function SvgCircleRangeLegendBlock({
  block,
  x,
  y,
  width,
  theme,
}: {
  block: Extract<LegendBlock, { kind: "circle-range" }>;
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  const centerX = x + width / 2;
  return (
    <g transform={`translate(0 ${y})`}>
      <text
        x={centerX}
        y={10}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={11}
        letterSpacing="0.06em"
      >
        {block.label.toUpperCase()}
      </text>
      <circle cx={centerX - 134} cy={26} r={3} fill={block.color} />
      <circle cx={centerX - 110} cy={26} r={7} fill={block.color} />
      <text
        x={centerX - 12}
        y={30}
        textAnchor="end"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        {block.minLabel}
      </text>
      <text
        x={centerX}
        y={30}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        →
      </text>
      <text
        x={centerX + 12}
        y={30}
        textAnchor="start"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        {block.maxLabel}
      </text>
    </g>
  );
}

function SvgLineRangeLegendBlock({
  block,
  x,
  y,
  width,
  theme,
}: {
  block: Extract<LegendBlock, { kind: "line-range" }>;
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  const centerX = x + width / 2;
  return (
    <g transform={`translate(0 ${y})`}>
      <text
        x={centerX}
        y={10}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={11}
        letterSpacing="0.06em"
      >
        {block.label.toUpperCase()}
      </text>
      <line
        x1={centerX - 144}
        y1={26}
        x2={centerX - 126}
        y2={26}
        stroke={block.color}
        strokeWidth={1}
      />
      <line
        x1={centerX - 118}
        y1={26}
        x2={centerX - 96}
        y2={26}
        stroke={block.color}
        strokeWidth={3.5}
      />
      <text
        x={centerX - 12}
        y={30}
        textAnchor="end"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        {block.minLabel}
      </text>
      <text
        x={centerX}
        y={30}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        →
      </text>
      <text
        x={centerX + 12}
        y={30}
        textAnchor="start"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={12}
      >
        {block.maxLabel}
      </text>
    </g>
  );
}

function SvgSizeSamplesLegendBlock({
  block,
  x,
  y,
  width,
  theme,
}: {
  block: Extract<LegendBlock, { kind: "size-samples" }>;
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  const sampleWidth = width / Math.max(1, block.samples.length);
  return (
    <g transform={`translate(0 ${y})`}>
      <text
        x={x + width / 2}
        y={10}
        textAnchor="middle"
        fill={theme.text.secondary}
        fontFamily={FONT_FAMILY}
        fontSize={11}
        letterSpacing="0.06em"
      >
        {block.label.toUpperCase()}
      </text>
      {block.samples.map((sample, index) => {
        const centerX = x + sampleWidth * index + sampleWidth / 2;
        return (
          <g key={`${sample.label}-${index}`}>
            <circle
              cx={centerX}
              cy={26}
              r={Math.min(10, sample.radius)}
              fill="none"
              stroke={theme.text.primary}
              strokeWidth={1.5}
            />
            <text
              x={centerX}
              y={43}
              textAnchor="middle"
              fill={theme.text.secondary}
              fontFamily={FONT_FAMILY}
              fontSize={11}
            >
              {sample.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function blockHeight(block: LegendBlock): number {
  switch (block.kind) {
    case "items":
      return 28;
    case "scale":
      return block.tickAt != null && block.tickLabel != null ? 46 : 32;
    case "circle-range":
    case "line-range":
      return 36;
    case "size-samples":
      return 48;
  }
}

function headerBlockHeight(): number {
  return 32;
}

function positionBlocks<T>({
  blocks,
  startY,
  heightFor,
  gap,
}: {
  blocks: T[];
  startY: number;
  heightFor: (block: T) => number;
  gap: number;
}): Array<{ block: T; y: number; index: number }> {
  return blocks.reduce<{
    entries: Array<{ block: T; y: number; index: number }>;
    nextY: number;
  }>(
    (acc, block, index) => ({
      entries: [...acc.entries, { block, y: acc.nextY, index }],
      nextY: acc.nextY + heightFor(block) + (index < blocks.length - 1 ? gap : 0),
    }),
    { entries: [], nextY: startY },
  ).entries;
}

function SvgHeaderBlocks({
  blocks,
  x,
  y,
  width,
  theme,
}: {
  blocks: HeaderBlock[];
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  if (blocks.length === 0) return null;

  const nodes = positionBlocks({
    blocks,
    startY: y,
    heightFor: () => headerBlockHeight(),
    gap: 8,
  }).map(({ block, y: currentY, index }) => {
    return (
      <SvgHeaderStatsBlock
        key={`header-stats-${index}`}
        block={block}
        x={x}
        y={currentY}
        width={width}
        theme={theme}
      />
    );
  });

  return <>{nodes}</>;
}

function SvgLegendBlocks({
  blocks,
  x,
  y,
  width,
  theme,
}: {
  blocks: LegendBlock[];
  x: number;
  y: number;
  width: number;
  theme: UITheme;
}) {
  if (blocks.length === 0) return null;

  const nodes = positionBlocks({
    blocks,
    startY: y,
    heightFor: blockHeight,
    gap: 10,
  }).map(({ block, y: currentY, index }) => {
    if (block.kind === "items") {
      return (
        <SvgLegendItemsRow
          key={`legend-items-${index}`}
          items={block.items}
          x={x}
          y={currentY}
          width={width}
          theme={theme}
        />
      );
    }
    if (block.kind === "scale") {
      return (
        <SvgScaleLegendBlock
          key={`legend-scale-${index}`}
          block={block}
          x={x}
          y={currentY}
          width={width}
          theme={theme}
        />
      );
    }
    if (block.kind === "circle-range") {
      return (
        <SvgCircleRangeLegendBlock
          key={`legend-circle-${index}`}
          block={block}
          x={x}
          y={currentY}
          width={width}
          theme={theme}
        />
      );
    }
    if (block.kind === "size-samples") {
      return (
        <SvgSizeSamplesLegendBlock
          key={`legend-size-samples-${index}`}
          block={block}
          x={x}
          y={currentY}
          width={width}
          theme={theme}
        />
      );
    }
    return (
      <SvgLineRangeLegendBlock
        key={`legend-line-${index}`}
        block={block}
        x={x}
        y={currentY}
        width={width}
        theme={theme}
      />
    );
  });

  return <>{nodes}</>;
}

export function StaticExportSvg({ spec }: { spec: ExportFrameSpec }) {
  const theme = resolveTheme(spec.theme);
  const background = resolveExportBackground(spec.background, theme, spec.theme);
  const headerBlocks = resolveHeaderBlocks(spec.chart);
  const legendBlocks = resolveLegendBlocks(spec.chart, theme);
  const titleBlockHeight =
    (spec.eyebrow ? 18 : 0) + (spec.title ? 50 : 0) + (spec.subtitle ? 30 : 0);
  const footerHeight = spec.footer ? 20 : 0;
  const headerBlocksHeight =
    headerBlocks.reduce((sum) => sum + headerBlockHeight(), 0) +
    Math.max(0, headerBlocks.length - 1) * 8;
  const legendHeight =
    legendBlocks.reduce((sum, block) => sum + blockHeight(block), 0) +
    Math.max(0, legendBlocks.length - 1) * 10;

  const chartBoxX = spec.padding;
  const headerY = spec.padding + titleBlockHeight + (titleBlockHeight > 0 ? 16 : 0);
  const chartBoxY = headerY + headerBlocksHeight + (headerBlocksHeight > 0 ? 12 : 0);
  const chartBoxWidth = spec.width - spec.padding * 2;
  const chartBoxHeight =
    spec.height -
    chartBoxY -
    spec.padding -
    footerHeight -
    legendHeight -
    (legendHeight > 0 ? 12 : 0) -
    (footerHeight > 0 ? 8 : 0);

  if (chartBoxWidth <= 0 || chartBoxHeight <= 0) {
    throw new Error("Export frame is too small for the requested padding and copy slots");
  }

  const aspect = chartAspectRatio(spec.chart);
  const fitWidth = Math.min(chartBoxWidth, chartBoxHeight * aspect);
  const fitHeight = fitWidth / aspect;
  const chartX = chartBoxX + (chartBoxWidth - fitWidth) / 2;
  const chartY = chartBoxY + (chartBoxHeight - fitHeight) / 2;
  let headingCursorY = spec.padding;
  const eyebrowY = spec.eyebrow ? headingCursorY + 14 : null;
  if (eyebrowY != null) headingCursorY += 18;
  const titleY = spec.title ? headingCursorY + 34 : null;
  if (titleY != null) headingCursorY += 50;
  const subtitleY = spec.subtitle ? headingCursorY + 20 : null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={spec.width}
      height={spec.height}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      role="img"
      aria-label={spec.title ?? "Campos export card"}
    >
      <rect x={0} y={0} width={spec.width} height={spec.height} fill={background} />

      {spec.eyebrow && eyebrowY != null ? (
        <text
          x={spec.padding}
          y={eyebrowY}
          fill={theme.text.secondary}
          fontFamily={FONT_FAMILY}
          fontSize={13}
          fontWeight={700}
          letterSpacing="0.08em"
        >
          {spec.eyebrow.toUpperCase()}
        </text>
      ) : null}

      {spec.title && titleY != null ? (
        <text
          x={spec.padding}
          y={titleY}
          fill={theme.text.primary}
          fontFamily={FONT_FAMILY}
          fontSize={34}
          fontWeight={700}
        >
          {spec.title}
        </text>
      ) : null}

      {spec.subtitle && subtitleY != null ? (
        <text
          x={spec.padding}
          y={subtitleY}
          fill={theme.text.secondary}
          fontFamily={FONT_FAMILY}
          fontSize={18}
        >
          {spec.subtitle}
        </text>
      ) : null}

      <SvgHeaderBlocks
        blocks={headerBlocks}
        x={spec.padding}
        y={headerY}
        width={spec.width - spec.padding * 2}
        theme={theme}
      />

      <svg x={chartX} y={chartY} width={fitWidth} height={fitHeight}>
        {renderChart(spec.chart, theme)}
      </svg>

      <SvgLegendBlocks
        blocks={legendBlocks}
        x={spec.padding}
        y={spec.height - spec.padding - footerHeight - legendHeight}
        width={spec.width - spec.padding * 2}
        theme={theme}
      />

      {spec.footer ? (
        <text
          x={spec.padding}
          y={spec.height - spec.padding}
          fill={theme.text.secondary}
          fontFamily={FONT_FAMILY}
          fontSize={13}
        >
          {spec.footer}
        </text>
      ) : null}
    </svg>
  );
}
