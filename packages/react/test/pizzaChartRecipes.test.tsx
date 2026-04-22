import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PizzaChartRow } from "../src/compute/index.js";

import {
  DARK_THEME,
  PizzaChart,
  ThemeProvider,
  mergeChartRecipeProps,
  pizzaChartRecipes,
} from "../src/index";

afterEach(cleanup);

const rows: PizzaChartRow[] = [
  {
    metric: "Goals",
    percentile: 92,
    category: "Attacking",
    rawValue: 0.68,
    displayValue: "92",
  },
  {
    metric: "Passes",
    percentile: 45,
    category: "Possession",
    rawValue: 22.1,
    displayValue: "45",
  },
  {
    metric: "Tackles",
    percentile: 24,
    category: "Defending",
    rawValue: 0.9,
    displayValue: "24",
  },
];

describe("pizzaChartRecipes", () => {
  it("single-colour recipe removes the legend and uses one slice hue", () => {
    const { getByTestId, queryByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <PizzaChart
          rows={rows}
          {...mergeChartRecipeProps(pizzaChartRecipes.singleColour)}
        />
      </ThemeProvider>,
    );

    expect(queryByTestId("pizza-legend")).toBeNull();
    const { categoryColors } = pizzaChartRecipes.singleColour.props;
    expect(typeof categoryColors).toBe("function");
    if (typeof categoryColors !== "function") {
      throw new Error("single-colour pizza recipe palette must resolve from theme");
    }
    expect(categoryColors(DARK_THEME)).toEqual([DARK_THEME.accent.blue]);
    const slices = getByTestId("pizza-slices").querySelectorAll("path");
    expect(slices[0]).toHaveAttribute("fill", DARK_THEME.accent.blue);
    expect(slices[1]).toHaveAttribute("fill", DARK_THEME.accent.blue);
  });

  it("benchmark-references recipe emphasizes reference arcs over the base grid", () => {
    const { getByTestId } = render(
      <PizzaChart
        rows={rows}
        referenceSets={[
          { label: "Median", values: { Goals: 50, Passes: 50, Tackles: 50 } },
        ]}
        {...mergeChartRecipeProps(pizzaChartRecipes.benchmarkReferences)}
      />,
    );

    const gridPath = getByTestId("pizza-grid").querySelector("path");
    const referencePath = getByTestId("pizza-reference-set-0").querySelector("path");
    expect(gridPath).toHaveAttribute("stroke-width", "0.6");
    expect(gridPath).toHaveAttribute("opacity", "0.72");
    expect(referencePath).toHaveAttribute("stroke-width", "1.5");
    expect(referencePath).toHaveAttribute("opacity", "0.95");
  });

  it("small-multiples recipe removes legend and value badges", () => {
    const { queryByTestId } = render(
      <PizzaChart
        rows={rows}
        {...mergeChartRecipeProps(pizzaChartRecipes.smallMultiples)}
      />,
    );

    expect(queryByTestId("pizza-legend")).toBeNull();
    expect(queryByTestId("pizza-badges")).toBeNull();
  });
});
