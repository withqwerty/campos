import type { PizzaChartProps } from "./PizzaChart.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";
import type { UITheme } from "./theme.js";

function singleColourPalette(theme: UITheme) {
  return [theme.accent.blue] as const;
}

/** Named pizza-chart presets for one-hue profiles and benchmark-heavy views. */
export const pizzaChartRecipes = defineChartRecipes({
  singleColour: defineChartRecipe<PizzaChartProps, "single-colour">({
    name: "single-colour",
    description:
      "One-hue percentile profile that keeps category grouping semantic while removing multi-colour slice encoding.",
    props: {
      categoryColors: singleColourPalette,
      showLegend: false,
    },
  }),
  benchmarkReferences: defineChartRecipe<PizzaChartProps, "benchmark-references">({
    name: "benchmark-references",
    description:
      "Reference-first percentile pizza styling that keeps grid chrome subdued and benchmark arcs visually prominent.",
    props: {
      guides: {
        strokeWidth: ({ kind }) => (kind === "reference" ? 1.5 : 0.6),
        opacity: ({ kind }) => (kind === "reference" ? 0.95 : 0.72),
      },
    },
  }),
  smallMultiples: defineChartRecipe<PizzaChartProps, "small-multiples">({
    name: "small-multiples",
    description:
      "Compact grid/tile variant that removes legend and value badges so dense pizza grids fail later at narrow widths.",
    props: {
      showLegend: false,
      showValueBadges: false,
    },
  }),
});

export type PizzaChartRecipe = (typeof pizzaChartRecipes)[keyof typeof pizzaChartRecipes];
