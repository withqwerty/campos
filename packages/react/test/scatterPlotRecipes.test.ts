import { describe, expect, it } from "vitest";

import { scatterPlotRecipes } from "../src/index";

describe("scatterPlotRecipes", () => {
  it("median-quadrants recipe adds the canonical median x/y guides", () => {
    expect(scatterPlotRecipes.medianQuadrants.props.guides).toEqual([
      { axis: "x", value: "median" },
      { axis: "y", value: "median" },
    ]);
  });

  it("finishing recipe pins the diagonal and outlier labeling defaults", () => {
    expect(scatterPlotRecipes.finishing.props).toMatchObject({
      referenceLine: "y=x",
      labelStrategy: "outliers",
      autoLabelCount: 6,
    });
  });

  it("ghost-outliers recipe keeps unlabeled points as ghost context", () => {
    expect(scatterPlotRecipes.ghostOutliers.props).toMatchObject({
      ghost: { mode: "unlabeled" },
      labelStrategy: "outliers",
      autoLabelCount: 5,
    });
  });
});
