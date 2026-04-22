import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RadarChartRow } from "../src/compute/index.js";

import {
  DARK_THEME,
  RadarChart,
  ThemeProvider,
  mergeChartRecipeProps,
  radarChartRecipes,
} from "../src/index";

afterEach(cleanup);

const rows: RadarChartRow[] = [
  { metric: "Goals", value: 0.68, percentile: 92, category: "Attacking" },
  { metric: "npxG", value: 0.54, percentile: 87, category: "Attacking" },
  { metric: "Shots", value: 3.4, percentile: 78, category: "Attacking" },
  { metric: "Passes", value: 22.1, percentile: 45, category: "Possession" },
  { metric: "Carries", value: 2.1, percentile: 71, category: "Possession" },
  { metric: "Tackles", value: 0.9, percentile: 24, category: "Defending" },
  { metric: "Pressures", value: 16.3, percentile: 62, category: "Defending" },
];

describe("radarChartRecipes", () => {
  it("statsbomb recipe pins the clipped banded radar defaults", () => {
    const { container } = render(
      <ThemeProvider value={DARK_THEME}>
        <RadarChart rows={rows} {...mergeChartRecipeProps(radarChartRecipes.statsbomb)} />
      </ThemeProvider>,
    );

    const { ringColors, outerRingColors } = radarChartRecipes.statsbomb.props;

    expect(radarChartRecipes.statsbomb.props.ringStyle).toBe("banded-inside-polygon");
    expect(typeof ringColors).toBe("function");
    expect(typeof outerRingColors).toBe("function");
    if (typeof ringColors !== "function" || typeof outerRingColors !== "function") {
      throw new Error("statsbomb radar recipe palettes must resolve from theme");
    }
    expect(ringColors(DARK_THEME)).toEqual([
      DARK_THEME.accent.yellow,
      DARK_THEME.accent.blue,
    ]);
    expect(outerRingColors(DARK_THEME)).toEqual([
      DARK_THEME.border.badge,
      DARK_THEME.axis.grid,
    ]);
    const firstLabel = container
      .querySelector('[data-testid="radar-labels"] text')
      ?.getAttribute("fill");
    expect(firstLabel).toBe(DARK_THEME.text.primary);
  });

  it("comparison recipe enables vertex value pills", () => {
    const { getByTestId } = render(
      <RadarChart rows={rows} {...mergeChartRecipeProps(radarChartRecipes.comparison)} />,
    );

    expect(getByTestId("radar-vertex-value-pills")).toBeInTheDocument();
  });

  it("small-multiples recipe removes legend and axis labels", () => {
    const { queryByTestId } = render(
      <RadarChart
        rows={rows}
        {...mergeChartRecipeProps(radarChartRecipes.smallMultiples)}
      />,
    );

    expect(queryByTestId("radar-legend")).toBeNull();
    expect(queryByTestId("radar-labels")).toBeNull();
  });
});
