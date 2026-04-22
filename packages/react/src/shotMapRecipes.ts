import type { ShotMapProps } from "./ShotMap.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

/** Named shot-map presets for editorial defaults and compact comparison tiles. */
export const shotMapRecipes = defineChartRecipes({
  opta: defineChartRecipe<ShotMapProps, "opta">({
    name: "opta",
    description:
      "Outcome-coloured Opta-style shot map with xG-driven marker size and all-circle markers.",
    props: {
      preset: "opta",
    },
  }),
  statsbomb: defineChartRecipe<ShotMapProps, "statsbomb">({
    name: "statsbomb",
    description:
      "StatsBomb-style shot map with a safer default xG ramp and body-part-driven marker shapes.",
    props: {
      preset: "statsbomb",
      colorScale: "magma",
    },
  }),
  summaryFirst: defineChartRecipe<ShotMapProps, "summary-first">({
    name: "summary-first",
    description:
      "Analyst-facing summary card with the headline shot and goal totals above the pitch.",
    props: {
      showHeaderStats: true,
    },
  }),
  smallMultiples: defineChartRecipe<ShotMapProps, "small-multiples">({
    name: "small-multiples",
    description: "Compact tile without legend or size scale for dense comparison grids.",
    props: {
      showLegend: false,
      showSizeScale: false,
      showScaleBar: false,
    },
  }),
});

export type ShotMapRecipe = (typeof shotMapRecipes)[keyof typeof shotMapRecipes];
