import type { XGTimelineProps } from "./XGTimeline.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

/** Named xG-timeline presets for Understat-style and editorial match views. */
export const xgTimelineRecipes = defineChartRecipes({
  understat: defineChartRecipe<XGTimelineProps, "understat">({
    name: "understat",
    description:
      "Ascending match-page xG timeline with the running score strip turned on.",
    props: {
      showScoreStrip: true,
    },
  }),
  mirroredScoreStrip: defineChartRecipe<XGTimelineProps, "mirrored-score-strip">({
    name: "mirrored-score-strip",
    description:
      "Mirrored editorial xG timeline with the running score strip for stronger home-away separation.",
    props: {
      layout: "mirrored",
      showScoreStrip: true,
    },
  }),
  lineOnly: defineChartRecipe<XGTimelineProps, "line-only">({
    name: "line-only",
    description:
      "Line-first editorial variant that removes fill and low-signal shot dots while keeping goals and major markers visible.",
    props: {
      showAreaFill: false,
      showShotDots: false,
    },
  }),
});

export type XGTimelineRecipe = (typeof xgTimelineRecipes)[keyof typeof xgTimelineRecipes];
