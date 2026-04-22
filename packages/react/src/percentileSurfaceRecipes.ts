import type { PercentileBarProps, PercentilePillProps } from "./PercentileSurfaces.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";

/**
 * Named `PercentileBar` presets. Callback props use the StyleValue context
 * so the resolved styling stays theme-aware at render time.
 */
export const percentileBarRecipes = defineChartRecipes({
  quiet: defineChartRecipe<PercentileBarProps, "quiet">({
    name: "quiet",
    description:
      "Muted track and subdued fill for card sidebars where the bar should not compete with neighbouring charts.",
    props: {
      track: {
        fill: ({ theme }) => theme.border.subtle,
        opacity: 0.6,
      },
      fill: {
        opacity: 0.85,
      },
      text: {
        fill: ({ theme, role }) =>
          role === "metricLabel" ? theme.text.primary : theme.text.secondary,
      },
    },
  }),
});

export type PercentileBarRecipeName = keyof typeof percentileBarRecipes;

export const percentilePillRecipes = defineChartRecipes({
  compact: defineChartRecipe<PercentilePillProps, "compact">({
    name: "compact",
    description:
      "Compact pill with the raw value suppressed — suited to dense list rows where the percentile is the primary read.",
    props: {
      showValue: false,
    },
  }),
});

export type PercentilePillRecipeName = keyof typeof percentilePillRecipes;
