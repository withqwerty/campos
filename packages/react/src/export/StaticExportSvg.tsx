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
import { PassSonarStaticSvg } from "../PassSonar.js";
import { PizzaChartStaticSvg } from "../PizzaChart.js";
import { RadarChartStaticSvg } from "../RadarChart.js";
import { ScatterPlotStaticSvg } from "../ScatterPlot.js";
import { ShotMapStaticSvg } from "../ShotMap.js";
import { TerritoryStaticSvg } from "../Territory.js";
import { XGTimelineStaticSvg } from "../XGTimeline.js";
import { PercentileBar } from "../PercentileSurfaces.js";
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
      return 360 / 56;
    case "pass-sonar":
      return 1;
    default:
      return unsupportedExportChartKind((chart as { kind: string }).kind);
  }
}

function resolveLegend(chart: ExportChartSpec, theme: UITheme): LegendItem[] {
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

    return model.lines
      .filter((line) => line.highlighted)
      .map((line) => ({
        key: line.team,
        label: line.teamLabel,
        color: line.color,
      }));
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

    return model.legend?.items ?? [];
  }

  if (chart.kind === "formation") {
    if ("home" in chart.props && "away" in chart.props) {
      return [
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
      ].filter((item) => item.label.length > 0);
    }

    if (chart.props.teamLabel != null && chart.props.teamLabel.length > 0) {
      return [
        {
          key: "team",
          label: chart.props.teamLabel,
          color: chart.props.teamColor ?? "#d33",
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
        ? { orientation: chart.props.attackingDirection }
        : {}),
      ...(chart.props.directed != null ? { directed: chart.props.directed } : {}),
      ...(chart.props.collisionPadding != null
        ? { collisionPadding: chart.props.collisionPadding }
        : {}),
    });

    return (
      model.legend?.rows.flatMap((row) => {
        if (row.kind !== "color") return [];
        if (row.mode === "team") {
          return [
            {
              key: row.label,
              label: row.label,
              color: row.color,
            },
          ];
        }

        return [
          {
            key: `${row.label}-min`,
            label: row.minLabel,
            color: row.gradient[0] ?? "#94a3b8",
          },
          {
            key: `${row.label}-max`,
            label: row.maxLabel,
            color: row.gradient[row.gradient.length - 1] ?? "#0f172a",
          },
        ];
      }) ?? []
    );
  }

  if (chart.kind === "shot-map") {
    const model = computeShotMap({
      shots: chart.props.shots,
      ...(chart.props.preset != null ? { preset: chart.props.preset } : {}),
      ...(chart.props.colorScale != null ? { colorScale: chart.props.colorScale } : {}),
    });

    return (
      model.legend?.groups.flatMap((group) =>
        group.items.map((item) => ({
          key: `${group.kind}-${item.key}`,
          label: item.label,
          color: item.color ?? "#64748b",
        })),
      ) ?? []
    );
  }

  if (chart.kind === "pass-map") {
    const model = computePassMap({
      passes: chart.props.passes,
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.attackingDirection != null
        ? { orientation: chart.props.attackingDirection }
        : {}),
    });

    return (
      model.legend?.items.map((item) => ({
        key: item.key,
        label: item.label,
        color: item.color,
      })) ?? []
    );
  }

  if (chart.kind === "pass-flow") {
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
    const stops = model.legend.stops;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const isDiverging =
      chart.props.colorScale === "diverging-rdbu" ||
      model.meta.valueMode === "relative-frequency";
    if (isDiverging) {
      // Diverging ramps encode deviation from a neutral midpoint, not
      // small-vs-large magnitude. Emit three items so "Baseline" (white) is
      // explicit; "Under" and "Over" reflect the signed nature of the
      // relative-frequency signal.
      const mid = stops[Math.floor(stops.length / 2)];
      return [
        { key: "passflow-under", label: "Under", color: first?.color ?? "#2166ac" },
        { key: "passflow-baseline", label: "Baseline", color: mid?.color ?? "#f7f7f7" },
        { key: "passflow-over", label: "Over", color: last?.color ?? "#b2182b" },
      ];
    }
    return [
      { key: "passflow-low", label: "Low", color: first?.color ?? "#94a3b8" },
      { key: "passflow-high", label: "High", color: last?.color ?? "#0f172a" },
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
        ? { orientation: chart.props.attackingDirection }
        : {}),
      ...(chart.props.crop != null ? { crop: chart.props.crop } : {}),
      ...(chart.props.metricLabel != null
        ? { metricLabel: chart.props.metricLabel }
        : {}),
      ...(chart.props.valueMode != null ? { valueMode: chart.props.valueMode } : {}),
    });

    if (!model.scaleBar) return [];
    const first = model.scaleBar.stops[0];
    const last = model.scaleBar.stops[model.scaleBar.stops.length - 1];
    return [
      {
        key: "heatmap-low",
        label: "Low",
        color: first?.color ?? "#94a3b8",
      },
      {
        key: "heatmap-high",
        label: "High",
        color: last?.color ?? "#0f172a",
      },
    ];
  }

  if (chart.kind === "scatter-plot") {
    const model = computeScatterPlot(chart.props);
    return model.legends.flatMap((legend) => {
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

    return model.endLabels.map((label) => ({
      key: label.teamId,
      label: label.text,
      color: label.color,
    }));
  }

  if (chart.kind === "percentile-bar") {
    return [];
  }

  if (chart.kind === "pass-sonar") {
    const palette = resolveThemePalette(chart.props.seriesColors, theme) ?? [
      "#3b82f6",
      "#22c55e",
    ];
    return [
      {
        key: "attempted",
        label: "Attempted passes",
        color: palette[0] ?? "#3b82f6",
      },
      {
        key: "completed",
        label: "Completed passes",
        color: palette[1] ?? "#22c55e",
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

  return (
    model.legend?.items.map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
    })) ?? []
  );
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
          <PercentileBar {...chart.props} />
        </ThemeProvider>
      );
    case "pass-sonar":
      return <PassSonarStaticSvg {...chart.props} theme={theme} />;
    default:
      return unsupportedExportChartKind((chart as { kind: string }).kind);
  }
}

function SvgLegendRow({
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

export function StaticExportSvg({ spec }: { spec: ExportFrameSpec }) {
  const theme = resolveTheme(spec.theme);
  const background = resolveExportBackground(spec.background, theme, spec.theme);
  const legendItems = resolveLegend(spec.chart, theme);
  const titleBlockHeight =
    (spec.eyebrow ? 18 : 0) + (spec.title ? 50 : 0) + (spec.subtitle ? 30 : 0);
  const footerHeight = spec.footer ? 20 : 0;
  const legendHeight = legendItems.length > 0 ? 28 : 0;

  const chartBoxX = spec.padding;
  const chartBoxY = spec.padding + titleBlockHeight + (titleBlockHeight > 0 ? 16 : 0);
  const chartBoxWidth = spec.width - spec.padding * 2;
  const chartBoxHeight =
    spec.height -
    chartBoxY -
    spec.padding -
    footerHeight -
    legendHeight -
    (footerHeight > 0 ? 8 : 0);

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

      <svg x={chartX} y={chartY} width={fitWidth} height={fitHeight}>
        {renderChart(spec.chart, theme)}
      </svg>

      <SvgLegendRow
        items={legendItems}
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
