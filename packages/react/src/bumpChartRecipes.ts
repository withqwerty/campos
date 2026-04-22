import type { BumpChartProps } from "./BumpChart.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

/** Named bump-chart presets for title-race and sparse-field tracker views. */
export const bumpChartRecipes = defineChartRecipes({
  focusRace: defineChartRecipe<BumpChartProps, "focus-race">({
    name: "focus-race",
    description:
      "Ranking-tracker preset for title races and playoff chases. Pair with highlightTeams to keep the story group on top.",
    props: {
      backgroundOpacity: 0.08,
      lines: {
        strokeWidth: ({ line }) => (line.highlighted ? 2.6 : 1.5),
      },
      points: {
        radius: ({ line }) => (line.highlighted ? 4 : 2.5),
      },
    },
  }),
  linearTrajectory: defineChartRecipe<BumpChartProps, "linear-trajectory">({
    name: "linear-trajectory",
    description:
      "Literal point-to-point ranking tracker with straight segments instead of smoothed movement.",
    props: {
      interpolation: "linear",
    },
  }),
  edgeLabels: defineChartRecipe<BumpChartProps, "edge-labels">({
    name: "edge-labels",
    description:
      "Sparse-field tracker variant that shows labels at both edges instead of relying only on end labels.",
    props: {
      showStartLabels: true,
      startLabelsForAllTeams: true,
      endLabelsForAllTeams: true,
    },
  }),
});

export type BumpChartRecipe = (typeof bumpChartRecipes)[keyof typeof bumpChartRecipes];
