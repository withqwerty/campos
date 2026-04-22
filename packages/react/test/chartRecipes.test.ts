import { describe, expect, it } from "vitest";

import {
  defineChartRecipe,
  defineChartRecipes,
  mergeChartRecipeProps,
} from "../src/chartRecipes";

type ExampleProps = {
  preset?: "opta" | "statsbomb";
  showLegend?: boolean;
  framePadding?: number;
};

const exampleRecipes = defineChartRecipes({
  provider: defineChartRecipe<ExampleProps, "provider-style">({
    name: "provider-style",
    description: "Provider-specific visual encoding.",
    props: {
      preset: "statsbomb",
      showLegend: true,
    },
  }),
  compact: defineChartRecipe<ExampleProps, "compact-tile">({
    name: "compact-tile",
    description: "Compact comparison tile.",
    props: {
      showLegend: false,
      framePadding: 0,
    },
  }),
});

describe("chartRecipes", () => {
  it("preserves machine-readable recipe metadata", () => {
    expect(exampleRecipes.provider.name).toBe("provider-style");
    expect(exampleRecipes.provider.description).toContain("Provider");
  });

  it("merges recipe props left to right", () => {
    expect(
      mergeChartRecipeProps(exampleRecipes.provider, exampleRecipes.compact),
    ).toEqual({
      preset: "statsbomb",
      showLegend: false,
      framePadding: 0,
    });
  });
});
