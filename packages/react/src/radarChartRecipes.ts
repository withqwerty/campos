import type { RadarChartProps } from "./RadarChart.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";
import type { UITheme } from "./theme.js";

function statsbombRingColors(theme: UITheme) {
  return [theme.accent.yellow, theme.accent.blue] as const;
}

function statsbombOuterRingColors(theme: UITheme) {
  return [theme.border.badge, theme.axis.grid] as const;
}

/** Named radar-chart presets for benchmark-recognizable scouting and comparison views. */
export const radarChartRecipes = defineChartRecipes({
  statsbomb: defineChartRecipe<RadarChartProps, "statsbomb">({
    name: "statsbomb",
    description:
      "Classic scouting radar treatment with polygon-clipped bands, alternating outer bands, and contrast-tuned guides.",
    props: {
      ringStyle: "banded-inside-polygon",
      ringColors: statsbombRingColors,
      outerRingColors: statsbombOuterRingColors,
      guides: {
        ringStroke: ({ theme }) => theme.axis.grid,
        spokeStroke: ({ theme }) => theme.axis.line,
      },
      areas: {
        stroke: ({ theme }) => theme.text.primary,
        strokeWidth: 1.5,
        markerFill: ({ theme }) => theme.text.primary,
      },
      text: {
        fill: ({ theme }) => theme.text.primary,
      },
    },
  }),
  comparison: defineChartRecipe<RadarChartProps, "comparison">({
    name: "comparison",
    description:
      "Comparison overlay helper that turns on per-vertex value pills while leaving series shaping outside the chart.",
    props: {
      showVertexValues: true,
    },
  }),
  smallMultiples: defineChartRecipe<RadarChartProps, "small-multiples">({
    name: "small-multiples",
    description:
      "Compact grid/tile variant that removes legend and axis labels when surrounding layout already carries metric context.",
    props: {
      showLegend: false,
      showAxisLabels: false,
    },
  }),
});

export type RadarChartRecipe = (typeof radarChartRecipes)[keyof typeof radarChartRecipes];
