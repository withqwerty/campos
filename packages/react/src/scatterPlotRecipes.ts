import type { ScatterPlotProps } from "./ScatterPlot.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

type ScatterRecipePoint = Record<string, string | number | boolean | null | undefined>;

const MEDIAN_QUADRANT_GUIDES = [
  { axis: "x" as const, value: "median" as const },
  { axis: "y" as const, value: "median" as const },
];

/** Named scatter-plot presets for canonical quadrant and outlier views. */
export const scatterPlotRecipes = defineChartRecipes({
  medianQuadrants: defineChartRecipe<
    ScatterPlotProps<ScatterRecipePoint>,
    "median-quadrants"
  >({
    name: "median-quadrants",
    description:
      "Benchmark quadrant scatter with median x/y guides. Pair with region inputs when the page needs named quadrants.",
    props: {
      guides: MEDIAN_QUADRANT_GUIDES,
    },
  }),
  finishing: defineChartRecipe<ScatterPlotProps<ScatterRecipePoint>, "finishing">({
    name: "finishing",
    description:
      "Finishing over/underperformance scatter with the y=x diagonal and automatic outlier labels.",
    props: {
      referenceLine: "y=x",
      labelStrategy: "outliers",
      autoLabelCount: 6,
    },
  }),
  ghostOutliers: defineChartRecipe<
    ScatterPlotProps<ScatterRecipePoint>,
    "ghost-outliers"
  >({
    name: "ghost-outliers",
    description:
      "Outlier-labeled scatter that keeps the unlabeled population as low-emphasis ghost points.",
    props: {
      ghost: { mode: "unlabeled" },
      labelStrategy: "outliers",
      autoLabelCount: 5,
    },
  }),
});

export type ScatterPlotRecipe =
  (typeof scatterPlotRecipes)[keyof typeof scatterPlotRecipes];
