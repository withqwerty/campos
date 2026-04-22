import type { ExportChartSpec } from "./types.js";

export const SUPPORTED_EXPORT_CHART_KINDS = [
  "bump-chart",
  "pizza-chart",
  "formation",
  "pass-network",
  "territory",
  "shot-map",
  "pass-map",
  "pass-flow",
  "heatmap",
  "scatter-plot",
  "xg-timeline",
  "radar-chart",
  "percentile-bar",
  "pass-sonar",
] as const;

export type SupportedExportChartKind = (typeof SUPPORTED_EXPORT_CHART_KINDS)[number];

export function isSupportedExportChartKind(
  kind: string,
): kind is SupportedExportChartKind {
  return (SUPPORTED_EXPORT_CHART_KINDS as readonly string[]).includes(kind);
}

export function unsupportedExportChartKind(kind: string): never {
  throw new Error(`Unsupported export chart kind: ${kind}`);
}

export function assertSupportedExportChartSpec(
  chart: ExportChartSpec | { kind: string; props: unknown },
): asserts chart is ExportChartSpec {
  if (!isSupportedExportChartKind(chart.kind)) {
    unsupportedExportChartKind(chart.kind);
  }
}
