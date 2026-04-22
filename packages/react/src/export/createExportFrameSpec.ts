import type {
  CreateExportFrameSpecInput,
  ExportChartSpec,
  ExportFormationProps,
  ExportBackgroundSpec,
  ExportFrameSpec,
  ExportPreset,
  ExportThemeName,
} from "./types.js";
import { assertSupportedExportChartSpec } from "./chart-kind.js";

const DEFAULT_PADDING = 48;
const DEFAULT_PRESET: ExportPreset = "share-card";
const DEFAULT_THEME: ExportThemeName = "light";

const PRESET_DIMENSIONS: Record<ExportPreset, { width: number; height: number }> = {
  "share-card": { width: 1200, height: 630 },
  "article-inline": { width: 960, height: 540 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const DEFAULT_BACKGROUND_BY_THEME: Record<ExportThemeName, ExportBackgroundSpec> = {
  light: { kind: "theme", token: "canvas" },
  dark: { kind: "theme", token: "canvas" },
};

function normalizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertPositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function isStyleValueMapLike(value: unknown): value is { by: unknown; values: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "by" in value &&
    typeof (value as { by?: unknown }).by === "function" &&
    "values" in value
  );
}

function assertConstantStyleObject(value: unknown, label: string) {
  if (value == null || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "function") {
      throw new Error(`${label}.${key} does not support callback style values in export`);
    }
    if (isStyleValueMapLike(entry)) {
      throw new Error(`${label}.${key} does not support mapped style values in export`);
    }
  }
}

function normalizeChart(chart: ExportChartSpec): ExportChartSpec {
  assertSupportedExportChartSpec(chart);

  if (chart.kind === "bump-chart") {
    assertConstantStyleObject(chart.props.lines, "bump-chart.lines");
    assertConstantStyleObject(chart.props.points, "bump-chart.points");
    assertConstantStyleObject(chart.props.labels, "bump-chart.labels");
    assertConstantStyleObject(chart.props.guides, "bump-chart.guides");

    const bumpChart = chart as ExportChartSpec & {
      props: ExportChartSpec["props"] & {
        renderEndLabel?: unknown;
        teamLogos?: Readonly<Record<string, string>>;
      };
    };
    if (bumpChart.props.renderEndLabel != null) {
      throw new Error(
        "BumpChart export does not support custom renderEndLabel in Phase 1",
      );
    }
    if (
      bumpChart.props.teamLogos != null &&
      Object.keys(bumpChart.props.teamLogos).length > 0
    ) {
      throw new Error("BumpChart export does not support teamLogos in Phase 1");
    }
    return chart;
  }

  if (chart.kind === "pizza-chart") {
    assertConstantStyleObject(chart.props.areas, "pizza-chart.areas");
    assertConstantStyleObject(chart.props.guides, "pizza-chart.guides");
    assertConstantStyleObject(chart.props.text, "pizza-chart.text");
    assertConstantStyleObject(chart.props.badges, "pizza-chart.badges");

    const pizzaChart = chart as ExportChartSpec & {
      props: ExportChartSpec["props"] & {
        centerContent?: { kind?: unknown };
      };
    };

    if (
      pizzaChart.props.centerContent?.kind === "image" ||
      pizzaChart.props.centerContent?.kind === "crest"
    ) {
      throw new Error(
        "PizzaChart export does not support image or crest centerContent in Phase 1",
      );
    }
    return chart;
  }

  if (chart.kind === "formation") {
    const formationProps = chart.props as Omit<
      ExportFormationProps,
      "markerComposition"
    > & {
      markerBadges?: unknown;
      markerComposition?: {
        glyph?: unknown;
        slots?: unknown;
      };
      substitutes?: readonly unknown[];
      home?: { substitutes?: readonly unknown[] };
      away?: { substitutes?: readonly unknown[] };
    };

    assertConstantStyleObject(formationProps.markers, "formation.markers");
    assertConstantStyleObject(formationProps.markerLabels, "formation.markerLabels");
    if (
      formationProps.markerComposition?.glyph === "photo" ||
      formationProps.markerComposition?.glyph === "photo-cutout" ||
      typeof formationProps.markerComposition?.glyph === "function"
    ) {
      throw new Error("Formation export does not support photo markers in Phase 1");
    }

    if (
      formationProps.markerBadges != null &&
      typeof formationProps.markerBadges === "object" &&
      Object.keys(formationProps.markerBadges as Record<string, unknown>).length > 0
    ) {
      throw new Error("Formation export does not support markerBadges in Phase 1");
    }

    if (formationProps.markerComposition?.slots != null) {
      throw new Error(
        "Formation export does not support marker slot renderers in Phase 1",
      );
    }

    if (formationProps.formation != null && formationProps.substitutes?.length) {
      throw new Error("Formation export does not support substitutes in Phase 1");
    }

    if (
      formationProps.home != null &&
      formationProps.away != null &&
      ((formationProps.home?.substitutes?.length ?? 0) > 0 ||
        (formationProps.away?.substitutes?.length ?? 0) > 0)
    ) {
      throw new Error("Formation export does not support substitutes in Phase 1");
    }

    return chart;
  }

  if (chart.kind === "pass-network") {
    assertConstantStyleObject(chart.props.nodeStyle, "pass-network.nodeStyle");
    assertConstantStyleObject(chart.props.edgeStyle, "pass-network.edgeStyle");
    return chart;
  }

  if (chart.kind === "territory") {
    assertConstantStyleObject(chart.props.cells, "territory.cells");
    assertConstantStyleObject(chart.props.labels, "territory.labels");
    return chart;
  }

  if (chart.kind === "shot-map") {
    assertConstantStyleObject(chart.props.markers, "shot-map.markers");
    assertConstantStyleObject(chart.props.trajectories, "shot-map.trajectories");
    return chart;
  }

  if (chart.kind === "pass-map") {
    assertConstantStyleObject(chart.props.lines, "pass-map.lines");
    assertConstantStyleObject(chart.props.dots, "pass-map.dots");
    return chart;
  }

  if (chart.kind === "pass-flow") {
    // PassFlow has no StyleValue-callback props — all styling is scalar
    // (colorScale, arrowColor, etc.). Pass-through is intentional; a future
    // style prop would add its assertConstantStyleObject check here.
    return chart;
  }

  if (chart.kind === "heatmap") {
    assertConstantStyleObject(chart.props.cells, "heatmap.cells");
    return chart;
  }

  if (chart.kind === "scatter-plot") {
    assertConstantStyleObject(chart.props.markers, "scatter-plot.markers");
    assertConstantStyleObject(chart.props.regionStyle, "scatter-plot.regionStyle");
    assertConstantStyleObject(chart.props.guideStyle, "scatter-plot.guideStyle");
    assertConstantStyleObject(chart.props.labelStyle, "scatter-plot.labelStyle");
    return chart;
  }

  if (chart.kind === "xg-timeline") {
    assertConstantStyleObject(chart.props.markers, "xg-timeline.markers");
    assertConstantStyleObject(chart.props.lines, "xg-timeline.lines");
    assertConstantStyleObject(chart.props.guides, "xg-timeline.guides");
    assertConstantStyleObject(chart.props.areas, "xg-timeline.areas");
    return chart;
  }

  if (chart.kind === "radar-chart") {
    assertConstantStyleObject(chart.props.areas, "radar-chart.areas");
    assertConstantStyleObject(chart.props.guides, "radar-chart.guides");
    assertConstantStyleObject(chart.props.text, "radar-chart.text");
    return chart;
  }

  if (chart.kind === "percentile-bar") {
    assertConstantStyleObject(chart.props.track, "percentile-bar.track");
    assertConstantStyleObject(chart.props.fill, "percentile-bar.fill");
    assertConstantStyleObject(chart.props.text, "percentile-bar.text");
    assertConstantStyleObject(chart.props.ticks, "percentile-bar.ticks");
    assertConstantStyleObject(chart.props.badges, "percentile-bar.badges");
    return chart;
  }

  if (chart.kind === "pass-sonar") {
    assertConstantStyleObject(chart.props.wedges, "pass-sonar.wedges");
    assertConstantStyleObject(chart.props.text, "pass-sonar.text");
    return chart;
  }

  return chart;
}

export function createExportFrameSpec(
  input: CreateExportFrameSpecInput,
): ExportFrameSpec {
  const preset = input.preset ?? DEFAULT_PRESET;
  const theme = input.theme ?? DEFAULT_THEME;
  const presetDimensions = PRESET_DIMENSIONS[preset];
  const width = input.width ?? presetDimensions.width;
  const height = input.height ?? presetDimensions.height;
  const padding = input.padding ?? DEFAULT_PADDING;
  const background = input.background ?? DEFAULT_BACKGROUND_BY_THEME[theme];

  assertPositiveNumber(width, "width");
  assertPositiveNumber(height, "height");
  assertPositiveNumber(padding, "padding");

  const eyebrow = normalizeText(input.eyebrow);
  const title = normalizeText(input.title);
  const subtitle = normalizeText(input.subtitle);
  const footer = normalizeText(input.footer);

  return {
    version: 1,
    width,
    height,
    preset,
    theme,
    padding,
    background,
    ...(eyebrow != null ? { eyebrow } : {}),
    ...(title != null ? { title } : {}),
    ...(subtitle != null ? { subtitle } : {}),
    ...(footer != null ? { footer } : {}),
    chart: normalizeChart(input.chart),
  };
}
