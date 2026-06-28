import { describe, expect, it } from "vitest";

import { fromVisual } from "../../src/visual/index.js";

describe("visual phase-map adapter", () => {
  it("packages output/cost quadrant points as reusable score-space visual data", () => {
    const snapshot = fromVisual.phaseMapSnapshot(
      {
        id: "match-1:phase-map",
        calibrationStatus: "insufficient-rich-sample",
        points: [
          {
            phaseId: "phase-1",
            side: "home",
            teamName: "Liverpool",
            label: "P1 12:04-12:18",
            phaseType: "chance sequence",
            period: 1,
            startMinute: 12,
            startSecond: 4,
            endMinute: 12,
            endSecond: 18,
            outputScore: 104.2,
            costScore: -3,
            repeatabilityScore: 88.4,
            repeatabilityLabel: "stable",
            quadrant: "high-output-low-cost",
            evidence: ["phase output/cost scores from consumer analysis"],
            caveat: "Within-match score-space point, not league calibration.",
            sourceMeta: { phaseId: "phase-1" },
          },
        ],
        centroids: [
          {
            side: "home",
            teamName: "Liverpool",
            outputScore: 67.2,
            costScore: 41.8,
            count: 82.9,
            evidence: ["mean of consumer phase points"],
            caveat: "Match-local centroid only.",
          },
        ],
        caveat: "Phase-map packet carries visual score geometry only.",
      },
      { matchId: "match-1" },
    );

    expect(snapshot).toMatchObject({
      id: "match-1:phase-map",
      matchId: "match-1",
      coordinateFrame: "diagnostic-score-space",
      calibrationStatus: "insufficient-rich-sample",
      provider: "visual",
      caveat: "Phase-map packet carries visual score geometry only.",
    });
    expect(snapshot.xAxis).toMatchObject({
      key: "pheno-output",
      label: "pheno-output score",
      domain: [0, 100],
    });
    expect(snapshot.points[0]).toMatchObject({
      id: "phase-1",
      phaseId: "phase-1",
      x: 100,
      y: 0,
      outputScore: 100,
      costScore: 0,
      repeatabilityScore: 88.4,
      quadrant: "high-output-low-cost",
      evidence: ["phase output/cost scores from consumer analysis"],
    });
    expect(snapshot.centroids[0]).toMatchObject({
      side: "home",
      outputScore: 67.2,
      costScore: 41.8,
      count: 82,
    });
    expect(snapshot).not.toHaveProperty("tacticalValue");
    expect(snapshot).not.toHaveProperty("prediction");
  });
});
