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
    const { xEdges, yEdges, pitchMarkings } = passFlowRecipes.positional20.props;

    // Edges should be a non-trivial tactical grid, strictly increasing, and
    // anchored to the full-pitch span. Count is provider-defined so we assert
    // the relation rather than a magic number.
    expect(Array.isArray(xEdges)).toBe(true);
    expect(Array.isArray(yEdges)).toBe(true);
    if (!Array.isArray(xEdges) || !Array.isArray(yEdges)) {
      throw new Error("expected edge arrays");
    }
    expect(xEdges.length).toBeGreaterThanOrEqual(2);
    expect(yEdges.length).toBeGreaterThanOrEqual(2);
    expect(xEdges[0]).toBe(0);
    expect(xEdges[xEdges.length - 1]).toBe(100);
    expect(yEdges[0]).toBe(0);
    expect(yEdges[yEdges.length - 1]).toBe(100);
    for (let i = 1; i < xEdges.length; i += 1) {
      expect(xEdges[i]).toBeGreaterThan(xEdges[i - 1] ?? -1);
    }
    for (let i = 1; i < yEdges.length; i += 1) {
      expect(yEdges[i]).toBeGreaterThan(yEdges[i - 1] ?? -1);
    }

    expect(pitchMarkings).toEqual({ zones: "20" });
  });
});
