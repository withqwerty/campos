import { zoneEdgesInCampos } from "@withqwerty/campos-stadia";

import type { PassFlowProps } from "./PassFlow.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

const POSITIONAL_20 = zoneEdgesInCampos("20");

/** Named pass-flow presets for density-heavy editorial and analysis views. */
export const passFlowRecipes = defineChartRecipes({
  statsbombCompleted: defineChartRecipe<PassFlowProps, "statsbomb-completed">({
    name: "statsbomb-completed",
    description:
      "Completed-pass flow view with sequential blues on share and the denser 12×8 broadcast grid.",
    props: {
      bins: { x: 12, y: 8 },
      completionFilter: "complete",
      colorScale: "sequential-blues",
      valueMode: "share",
    },
  }),
  countScaledArrows: defineChartRecipe<PassFlowProps, "count-scaled-arrows">({
    name: "count-scaled-arrows",
    description:
      "Arrow length encodes origin volume. Useful when the color channel is already doing another job in a composite.",
    props: {
      bins: { x: 12, y: 8 },
      arrowLengthMode: "scaled-by-count",
    },
  }),
  averageDistanceArrows: defineChartRecipe<PassFlowProps, "average-distance-arrows">({
    name: "average-distance-arrows",
    description:
      "Arrow length encodes mean pass distance per bin, surfacing long-ball and switch-heavy zones without changing color semantics.",
    props: {
      bins: { x: 12, y: 8 },
      arrowLengthMode: "scaled-by-distance",
    },
  }),
  positional20: defineChartRecipe<PassFlowProps, "positional-20">({
    name: "positional-20",
    description:
      "Shared 20-zone positional layout with aligned pitch markings. Use this when the flow should sit on benchmark tactical zones rather than a uniform grid.",
    props: {
      xEdges: POSITIONAL_20.xEdges,
      yEdges: POSITIONAL_20.yEdges,
      pitchMarkings: { zones: "20" },
    },
  }),
  smallMultiples: defineChartRecipe<PassFlowProps, "small-multiples">({
    name: "small-multiples",
    description:
      "Compact comparison tile with chart chrome removed and tighter containment for multi-chart grids.",
    props: {
      showHeaderStats: false,
      showLegend: false,
      framePadding: 0,
      arrowContainment: 0.72,
      minCountForArrow: 1,
    },
  }),
});

export type PassFlowRecipe = (typeof passFlowRecipes)[keyof typeof passFlowRecipes];
