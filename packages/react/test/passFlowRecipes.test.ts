import { describe, expect, it } from "vitest";

import { passFlowRecipes } from "../src/index";

describe("passFlowRecipes", () => {
  it("statsbombCompleted recipe pins the completed-share broadcast defaults", () => {
    expect(passFlowRecipes.statsbombCompleted.props).toMatchObject({
      bins: { x: 12, y: 8 },
      completionFilter: "complete",
      colorScale: "sequential-blues",
      valueMode: "share",
    });
  });

  it("averageDistanceArrows recipe switches arrow length encoding to distance", () => {
    expect(passFlowRecipes.averageDistanceArrows.props.arrowLengthMode).toBe(
      "scaled-by-distance",
    );
  });

  it("positional20 recipe wires edges and markings together", () => {
    expect(passFlowRecipes.positional20.props.xEdges).toBeDefined();
    expect(passFlowRecipes.positional20.props.yEdges).toBeDefined();
    expect(passFlowRecipes.positional20.props.pitchMarkings).toEqual({ zones: "20" });
  });
});
