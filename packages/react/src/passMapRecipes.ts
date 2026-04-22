import type { PassMapProps } from "./PassMap.js";
import { defineChartRecipe, defineChartRecipes } from "./chartRecipes.js";
import type { UITheme } from "./theme.js";

function completedColor(theme: UITheme) {
  return theme.accent.blue;
}

function crossColor(theme: UITheme) {
  return theme.accent.red;
}

function assistColor(theme: UITheme) {
  return theme.accent.blue;
}

function unknownRecipientColor(theme: UITheme) {
  return theme.accent.slate;
}

function recipientPalette(theme: UITheme) {
  return [
    theme.accent.blue,
    theme.accent.red,
    theme.accent.green,
    theme.accent.purple,
    theme.accent.orange,
    theme.accent.yellow,
  ] as const;
}

function recipientColor(recipient: string | null | undefined, theme: UITheme) {
  if (recipient == null || recipient.trim().length === 0) {
    return unknownRecipientColor(theme);
  }
  let hash = 0;
  for (const char of recipient) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const palette = recipientPalette(theme);
  return palette[hash % palette.length] ?? unknownRecipientColor(theme);
}

/** Named pass-map presets for common editorial slices and subset views. */
export const passMapRecipes = defineChartRecipes({
  completed: defineChartRecipe<PassMapProps, "completed">({
    name: "completed",
    description:
      "Subset view that shows only completed passes and strips chrome that would otherwise describe the full input set.",
    props: {
      showHeaderStats: false,
      showLegend: false,
      lines: {
        show: ({ pass }) => pass.passResult === "complete",
        stroke: ({ theme }) => completedColor(theme),
        opacity: ({ active }) => (active ? 1 : 0.82),
      },
      dots: {
        show: ({ pass }) => pass.passResult === "complete",
        fill: ({ theme }) => completedColor(theme),
        opacity: ({ active }) => (active ? 1 : 0.9),
      },
    },
  }),
  passType: defineChartRecipe<PassMapProps, "pass-type">({
    name: "pass-type",
    description:
      "Color each pass by pass type instead of completion. Hides the built-in completion legend because the recipe changes the color semantics.",
    props: {
      showLegend: false,
      lines: {
        stroke: ({ pass, theme }) => {
          switch (pass.passType) {
            case "ground":
              return theme.accent.blue;
            case "high":
              return theme.accent.purple;
            case "cross":
              return crossColor(theme);
            default:
              return unknownRecipientColor(theme);
          }
        },
        strokeDasharray: {
          by: ({ pass }) => pass.passResult ?? "unknown",
          values: {
            incomplete: "2 2",
          },
        },
      },
    },
  }),
  recipient: defineChartRecipe<PassMapProps, "recipient">({
    name: "recipient",
    description:
      "Color each pass by recipient for editorial spotlight views. Uses a six-colour hash over the recipient name; collisions are likely past ~6 distinct recipients, so supply a `lines.stroke` / `dots.fill` override mapped by recipient for publication graphics. Hides the built-in completion legend because color no longer maps to completion.",
    props: {
      showLegend: false,
      lines: {
        stroke: ({ pass, theme }) => recipientColor(pass.recipient, theme),
        opacity: ({ pass, active }) =>
          active ? 1 : pass.passResult === "complete" ? 0.85 : 0.55,
      },
      dots: {
        fill: ({ pass, theme }) => recipientColor(pass.recipient, theme),
        radius: 1.8,
      },
    },
  }),
  crosses: defineChartRecipe<PassMapProps, "crosses">({
    name: "crosses",
    description:
      "Subset view for crosses only. Uses a louder red stroke and removes default chrome so the recipe reads as a focused editorial slice.",
    props: {
      showHeaderStats: false,
      showLegend: false,
      lines: {
        show: ({ pass }) => pass.passType === "cross",
        stroke: ({ theme }) => crossColor(theme),
        strokeWidth: 0.8,
        opacity: ({ active }) => (active ? 1 : 0.9),
      },
      dots: {
        show: ({ pass }) => pass.passType === "cross",
        fill: ({ theme }) => crossColor(theme),
        radius: 1.6,
        opacity: ({ active }) => (active ? 1 : 0.9),
      },
    },
  }),
  shotAssists: defineChartRecipe<PassMapProps, "shot-assists">({
    name: "shot-assists",
    description:
      "Subset view for shot-assist passes only. Uses a darker blue emphasis and hides default chrome because the subset is the story.",
    props: {
      showHeaderStats: false,
      showLegend: false,
      lines: {
        show: ({ pass }) => pass.isAssist,
        stroke: ({ theme }) => assistColor(theme),
        strokeWidth: 0.9,
        opacity: ({ active }) => (active ? 1 : 0.92),
      },
      dots: {
        show: ({ pass }) => pass.isAssist,
        fill: ({ theme }) => assistColor(theme),
        radius: 1.9,
        opacity: ({ active }) => (active ? 1 : 0.92),
      },
    },
  }),
  dense: defineChartRecipe<PassMapProps, "dense">({
    name: "dense",
    description:
      "Dense-sample chrome preset for article graphics and heavy first-half maps. Removes summary chrome first so it composes cleanly with the subset recipes.",
    props: {
      showHeaderStats: false,
      showLegend: false,
    },
  }),
});

export type PassMapRecipe = (typeof passMapRecipes)[keyof typeof passMapRecipes];
