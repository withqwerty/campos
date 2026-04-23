import { describe, expect, it } from "vitest";

import { bumpChartRecipes } from "../src/index";

describe("bumpChartRecipes", () => {
  it("focus-race recipe deepens highlighted-vs-background separation", () => {
    const { props } = bumpChartRecipes.focusRace;
    expect(props.backgroundOpacity).toBe(0.08);

    // Strokewidth and radius are value-picker functions that branch on
    // `line.highlighted`. Assert both the shape and the highlighted-vs-default
    // output so a regression in the function body surfaces immediately.
    expect(typeof props.lines?.strokeWidth).toBe("function");
    expect(typeof props.points?.radius).toBe("function");

    const strokeWidth = props.lines?.strokeWidth;
    const radius = props.points?.radius;
    if (typeof strokeWidth !== "function" || typeof radius !== "function") {
      throw new Error("expected value-picker functions");
    }
    // Input shape mirrors the per-line render context BumpChart passes in.
    // Line and point pickers accept different context types; build each with
    // its own `Parameters<…>[0]` cast so exactOptionalPropertyTypes stays
    // happy.
    const strokeHighlighted = { line: { highlighted: true } } as Parameters<
      typeof strokeWidth
    >[0];
    const strokeBackground = { line: { highlighted: false } } as Parameters<
      typeof strokeWidth
    >[0];
    const radiusHighlighted = { line: { highlighted: true } } as Parameters<
      typeof radius
    >[0];
    const radiusBackground = { line: { highlighted: false } } as Parameters<
      typeof radius
    >[0];

    expect(strokeWidth(strokeHighlighted)).toBe(2.6);
    expect(strokeWidth(strokeBackground)).toBe(1.5);
    expect(radius(radiusHighlighted)).toBe(4);
    expect(radius(radiusBackground)).toBe(2.5);
  });

  it("linear-trajectory recipe switches interpolation to linear", () => {
    expect(bumpChartRecipes.linearTrajectory.props.interpolation).toBe("linear");
  });

  it("edge-labels recipe enables labels at both chart edges", () => {
    expect(bumpChartRecipes.edgeLabels.props).toMatchObject({
      showStartLabels: true,
      startLabelsForAllTeams: true,
      endLabelsForAllTeams: true,
    });
  });
});
