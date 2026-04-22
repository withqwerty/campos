import { describe, expect, it } from "vitest";

import { bumpChartRecipes } from "../src/index";

describe("bumpChartRecipes", () => {
  it("focus-race recipe deepens highlighted-vs-background separation", () => {
    expect(bumpChartRecipes.focusRace.props.backgroundOpacity).toBe(0.08);
    expect(bumpChartRecipes.focusRace.props.lines).toBeDefined();
    expect(bumpChartRecipes.focusRace.props.points).toBeDefined();
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
