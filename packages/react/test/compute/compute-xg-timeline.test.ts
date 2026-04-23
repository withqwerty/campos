import { describe, expect, it } from "vitest";

import type { Shot } from "@withqwerty/campos-schema";

import { computeXGTimeline } from "../../src/compute/index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    kind: "shot" as const,
    id: "s1",
    matchId: "m1",
    teamId: "home",
    playerId: "p1",
    playerName: "Salah",
    minute: 25,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 90,
    y: 40,
    xg: 0.15,
    outcome: "saved",
    bodyPart: "right-foot",
    isOwnGoal: false,
    isPenalty: false,
    context: "regular-play",
    provider: "opta",
    providerEventId: "e1",
    ...overrides,
  };
}

const HOME = "home";
const AWAY = "away";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeXGTimeline", () => {
  // ---- empty / edge states ------------------------------------------------

  it("returns emptyState when shots array is empty", () => {
    const model = computeXGTimeline({
      shots: [],
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    expect(model.meta.empty).toBe(true);
    expect(model.meta.totalShots).toBe(0);
    expect(model.meta.validShots).toBe(0);
    expect(model.emptyState).toEqual({ message: "No shot data" });
    expect(model.stepLines).toHaveLength(0);
    expect(model.markers).toHaveLength(0);
    expect(model.endLabels).toHaveLength(0);
    expect(model.guides).toHaveLength(0);
    // Empty model still provides sensible axis defaults
    expect(model.axes.x.domain).toEqual([0, 90]);
    expect(model.axes.y.domain[0]).toBe(0);
  });

  // ---- validation ---------------------------------------------------------

  it("excludes shots with null xg and emits a warning", () => {
    const shots: Shot[] = [
      makeShot({ id: "s1", xg: null, minute: 10 }),
      makeShot({ id: "s2", xg: 0.22, minute: 30 }),
    ];

    const model = computeXGTimeline({
      shots,
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    expect(model.meta.empty).toBe(false);
    expect(model.meta.totalShots).toBe(2);
    expect(model.meta.validShots).toBe(1);
    expect(model.meta.warnings).toHaveLength(1);
    expect(model.meta.warnings[0]).toMatch(/1 shot\(s\) excluded/);
  });

  it("excludes shots with empty teamId", () => {
    const shots: Shot[] = [
      makeShot({ id: "s1", teamId: "", xg: 0.1, minute: 5 }),
      makeShot({ id: "s2", teamId: HOME, xg: 0.2, minute: 20 }),
    ];

    const model = computeXGTimeline({
      shots,
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    expect(model.meta.validShots).toBe(1);
    expect(model.meta.warnings.some((w) => w.includes("excluded"))).toBe(true);
  });

  it("warns when a shot teamId matches neither homeTeam nor awayTeam", () => {
    const shots: Shot[] = [
      makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 5 }),
      makeShot({ id: "s2", teamId: "third-team", xg: 0.4, minute: 30 }),
      makeShot({ id: "s3", teamId: "fourth-team", xg: 0.5, minute: 60 }),
    ];

    const model = computeXGTimeline({
      shots,
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    const warning = model.meta.warnings.find((w) =>
      w.includes("matched neither homeTeam"),
    );
    expect(warning).toBeDefined();
    expect(warning).toContain("third-team");
    expect(warning).toContain("fourth-team");
  });

  it("returns emptyState when all shots have null xg", () => {
    const shots: Shot[] = [
      makeShot({ id: "s1", xg: null }),
      makeShot({ id: "s2", xg: null }),
    ];

    const model = computeXGTimeline({
      shots,
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No shot data" });
    expect(model.meta.warnings).toHaveLength(1);
    expect(model.meta.warnings[0]).toMatch(/2 shot\(s\) excluded/);
  });

  // ---- step-after construction --------------------------------------------

  describe("step-after path construction", () => {
    it("cumulative xG per team starts at (0,0) and extends to end minute", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 20, period: 1 }),
        makeShot({ id: "s2", teamId: HOME, xg: 0.15, minute: 60, period: 2 }),
        makeShot({ id: "s3", teamId: AWAY, xg: 0.35, minute: 40, period: 1 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;

      // Both lines start at minute 0 with cumXg 0
      expect(homeLine.points[0]!.minute).toBe(0);
      expect(homeLine.points[0]!.cumXg).toBe(0);
      expect(awayLine.points[0]!.minute).toBe(0);
      expect(awayLine.points[0]!.cumXg).toBe(0);

      // Both lines end at minute 90
      const homeEnd = homeLine.points[homeLine.points.length - 1]!;
      const awayEnd = awayLine.points[awayLine.points.length - 1]!;
      expect(homeEnd.minute).toBe(90);
      expect(awayEnd.minute).toBe(90);

      // Final cumXg matches totalXg
      expect(homeEnd.cumXg).toBeCloseTo(0.35);
      expect(homeLine.totalXg).toBeCloseTo(0.35);
      expect(awayEnd.cumXg).toBeCloseTo(0.35);
      expect(awayLine.totalXg).toBeCloseTo(0.35);
    });

    it("step-after path contains M, H, and V commands", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 20, period: 1 }),
        makeShot({ id: "s2", teamId: HOME, xg: 0.3, minute: 60, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;

      // Step-after path must include M (start), H (horizontal), V (vertical jump)
      expect(homeLine.path).toMatch(/^M /);
      expect(homeLine.path).toContain("H ");
      expect(homeLine.path).toContain("V ");
    });

    it("cumulative xG values accumulate monotonically", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.1, minute: 10, period: 1 }),
        makeShot({ id: "s2", teamId: HOME, xg: 0.2, minute: 30, period: 1 }),
        makeShot({ id: "s3", teamId: HOME, xg: 0.15, minute: 65, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      const xgValues = homeLine.points.map((p) => p.cumXg);

      // xG values should never decrease (monotonically non-decreasing)
      for (let i = 1; i < xgValues.length; i++) {
        expect(xgValues[i]!).toBeGreaterThanOrEqual(xgValues[i - 1]!);
      }
    });
  });

  // ---- stoppage time -------------------------------------------------------

  describe("stoppage time", () => {
    it("folds addedMinute into linear time (45+2 → 47)", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.25,
          minute: 45,
          addedMinute: 2,
          period: 1,
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      // The shot point (not the origin) should be at linear minute 47
      const shotPoint = homeLine.points.find((p) => p.minute === 47);
      expect(shotPoint).toBeDefined();
    });

    it("folds addedMinute into linear time (90+3 → 93)", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: AWAY,
          xg: 0.18,
          minute: 90,
          addedMinute: 3,
          period: 2,
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;
      // Endpoint should be at 93 (maxMinute > 90, no extra time periods)
      expect(model.axes.x.domain[1]).toBe(93);
      const shotPoint = awayLine.points.find((p) => p.minute === 93);
      expect(shotPoint).toBeDefined();
    });

    it("creates a background band for first-half stoppage time", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.1,
          minute: 45,
          addedMinute: 3,
          period: 1,
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      // Should have a stoppage band for the first half (45→48 region)
      expect(model.backgroundBands.length).toBeGreaterThanOrEqual(1);
      const stoppageBand = model.backgroundBands.find((b) => b.label === null);
      expect(stoppageBand).toBeDefined();
      expect(stoppageBand!.x).toBeGreaterThan(0);
      expect(stoppageBand!.width).toBeGreaterThan(0);
    });

    it("creates a background band for second-half stoppage time", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.1, minute: 10, period: 1 }),
        makeShot({
          id: "s2",
          teamId: AWAY,
          xg: 0.22,
          minute: 90,
          addedMinute: 4,
          period: 2,
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const nullBands = model.backgroundBands.filter((b) => b.label === null);
      expect(nullBands.length).toBeGreaterThanOrEqual(1);
      // At least one band should start at or beyond x-position of minute 90
      const htX = model.guides.find((g) => g.label === "FT")!.x;
      const secondHalfBand = nullBands.find((b) => b.x >= htX);
      expect(secondHalfBand).toBeDefined();
    });

    it("does not treat 90+ stoppage time as extra time when no ET periods exist", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.1, minute: 10, period: 1 }),
        makeShot({
          id: "s2",
          teamId: AWAY,
          xg: 0.22,
          minute: 90,
          addedMinute: 9,
          period: 2,
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.axes.x.domain[1]).toBe(99);
      expect(model.guides.map((guide) => guide.label)).not.toContain("ET HT");
      expect(model.guides.map((guide) => guide.label)).not.toContain("ET FT");
      expect(model.backgroundBands.some((band) => band.label === "ET")).toBe(false);
    });
  });

  // ---- extra time ---------------------------------------------------------

  describe("extra time", () => {
    it("extends x-axis domain beyond 90 when period 3 shots exist", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 30, period: 1 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.1, minute: 105, period: 3 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.axes.x.domain[1]).toBeGreaterThanOrEqual(120);
    });

    it("adds ET HT and ET FT guides when extra time is present", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 110, period: 3 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.15, minute: 118, period: 4 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const guideLabels = model.guides.map((g) => g.label);
      expect(guideLabels).toContain("HT");
      expect(guideLabels).toContain("FT");
      expect(guideLabels).toContain("ET HT");
      expect(guideLabels).toContain("ET FT");
    });

    it("creates an ET background band with label 'ET'", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.3, minute: 100, period: 3 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const etBand = model.backgroundBands.find((b) => b.label === "ET");
      expect(etBand).toBeDefined();
      expect(etBand!.width).toBeGreaterThan(0);
      expect(etBand!.height).toBeGreaterThan(0);
    });

    it("ET guide x-positions are correctly ordered (FT < ET HT < ET FT)", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 108, period: 3 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.1, minute: 115, period: 4 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const ftGuide = model.guides.find((g) => g.label === "FT")!;
      const etHtGuide = model.guides.find((g) => g.label === "ET HT")!;
      const etFtGuide = model.guides.find((g) => g.label === "ET FT")!;

      expect(ftGuide.x).toBeLessThan(etHtGuide.x);
      expect(etHtGuide.x).toBeLessThan(etFtGuide.x);
    });
  });

  // ---- annotation tiers ---------------------------------------------------

  describe("annotation tiers", () => {
    it("goals are tier 1", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.05,
          minute: 25,
          outcome: "goal",
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const marker = model.markers.find((m) => m.id === "s1")!;
      expect(marker.tier).toBe(1);
      expect(marker.isGoal).toBe(true);
    });

    it("non-goal shots with xG >= 0.3 are tier 2", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.35,
          minute: 30,
          outcome: "saved",
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const marker = model.markers.find((m) => m.id === "s1")!;
      expect(marker.tier).toBe(2);
      expect(marker.isGoal).toBe(false);
    });

    it("non-goal shots with xG < 0.3 are tier 3", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.08,
          minute: 15,
          outcome: "saved",
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const marker = model.markers.find((m) => m.id === "s1")!;
      expect(marker.tier).toBe(3);
    });

    it("annotations are only generated for tier 1 and tier 2 markers", () => {
      const shots: Shot[] = [
        makeShot({ id: "goal1", teamId: HOME, xg: 0.1, minute: 20, outcome: "goal" }), // tier 1
        makeShot({
          id: "bigchance",
          teamId: AWAY,
          xg: 0.45,
          minute: 55,
          outcome: "saved",
        }), // tier 2
        makeShot({ id: "low1", teamId: HOME, xg: 0.05, minute: 70, outcome: "saved" }), // tier 3
        makeShot({ id: "low2", teamId: AWAY, xg: 0.08, minute: 80, outcome: "blocked" }), // tier 3
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const annotationMarkerIds = model.annotations.map((a) => a.markerId);
      expect(annotationMarkerIds).toContain("goal1");
      expect(annotationMarkerIds).toContain("bigchance");
      expect(annotationMarkerIds).not.toContain("low1");
      expect(annotationMarkerIds).not.toContain("low2");
    });

    it("goal annotations include player name", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.25,
          minute: 35,
          outcome: "goal",
          playerName: "Salah",
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const annotation = model.annotations.find((a) => a.markerId === "s1")!;
      expect(annotation).toBeDefined();
      expect(annotation.text).toContain("Salah");
      expect(annotation.text).toContain("0.25");
    });

    it("tier 2 annotations only include xG value (not player name)", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.42,
          minute: 35,
          outcome: "saved",
          playerName: "Firmino",
        }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const annotation = model.annotations.find((a) => a.markerId === "s1")!;
      expect(annotation).toBeDefined();
      expect(annotation.text).toBe("0.42");
      expect(annotation.text).not.toContain("Firmino");
    });
  });

  // ---- end labels ---------------------------------------------------------

  describe("end labels", () => {
    it("produces two end labels with formatted totalXg text", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.33, minute: 40, period: 1 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.18, minute: 70, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.endLabels).toHaveLength(2);

      const homeLabel = model.endLabels.find((l) => l.teamId === HOME)!;
      const awayLabel = model.endLabels.find((l) => l.teamId === AWAY)!;

      expect(homeLabel.text).toBe("0.33");
      expect(awayLabel.text).toBe("0.18");
    });

    it("overlapping end labels are separated by at least 12px", () => {
      // Create shots that result in nearly identical total xG to force overlap avoidance
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.3, minute: 40, period: 1 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.3, minute: 50, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const homeLabel = model.endLabels.find((l) => l.teamId === HOME)!;
      const awayLabel = model.endLabels.find((l) => l.teamId === AWAY)!;

      const gap = Math.abs(homeLabel.y - awayLabel.y);
      expect(gap).toBeGreaterThanOrEqual(12);
    });

    it("end labels are positioned to the right of the plot area", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 30, period: 1 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const plotRight = model.layout.plotArea.x + model.layout.plotArea.width;

      for (const label of model.endLabels) {
        expect(label.x).toBeGreaterThan(plotRight);
      }
    });
  });

  // ---- score strip --------------------------------------------------------

  describe("score strip", () => {
    it("score strip is empty when showScoreStrip is false (default)", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.4, minute: 30, outcome: "goal" }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.2, minute: 60, outcome: "saved" }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.scoreStrip).toHaveLength(0);
    });

    it("score strip is empty when showScoreStrip is explicitly false", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.4, minute: 30, outcome: "goal" }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        showScoreStrip: false,
      });

      expect(model.scoreStrip).toHaveLength(0);
    });

    it("score strip has segments at goal events when enabled", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.4,
          minute: 30,
          period: 1,
          outcome: "goal",
        }),
        makeShot({
          id: "s2",
          teamId: AWAY,
          xg: 0.6,
          minute: 70,
          period: 2,
          outcome: "goal",
        }),
        makeShot({
          id: "s3",
          teamId: HOME,
          xg: 0.2,
          minute: 80,
          period: 2,
          outcome: "saved",
        }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        showScoreStrip: true,
      });

      // 2 goals → 3 segments (before goal 1, between goals, after goal 2)
      expect(model.scoreStrip).toHaveLength(3);
    });

    it("score strip segment labels reflect running score", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.4,
          minute: 25,
          period: 1,
          outcome: "goal",
        }),
        makeShot({
          id: "s2",
          teamId: HOME,
          xg: 0.3,
          minute: 55,
          period: 2,
          outcome: "goal",
        }),
        makeShot({
          id: "s3",
          teamId: AWAY,
          xg: 0.5,
          minute: 75,
          period: 2,
          outcome: "goal",
        }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        showScoreStrip: true,
      });

      const labels = model.scoreStrip.map((s) => s.label);
      expect(labels).toContain("0 - 0");
      expect(labels).toContain("1 - 0");
      expect(labels).toContain("2 - 0");
      expect(labels).toContain("2 - 1");
    });

    it("score strip has a single segment (no goals) when enabled with no goal shots", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.2, minute: 30, outcome: "saved" }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.1, minute: 60, outcome: "blocked" }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        showScoreStrip: true,
      });

      expect(model.scoreStrip).toHaveLength(1);
      expect(model.scoreStrip[0]!.label).toBe("0 - 0");
    });

    it("score strip segment fills reflect the team in front", () => {
      const shots: Shot[] = [
        makeShot({
          id: "s1",
          teamId: HOME,
          xg: 0.4,
          minute: 25,
          period: 1,
          outcome: "goal",
        }),
        makeShot({
          id: "s2",
          teamId: AWAY,
          xg: 0.5,
          minute: 70,
          period: 2,
          outcome: "goal",
        }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        showScoreStrip: true,
      });

      expect(model.scoreStrip.map((segment) => segment.fill)).toEqual([
        "transparent",
        "#c8102e",
        "transparent",
      ]);
    });
  });

  // ---- one-team fallback --------------------------------------------------

  describe("one-team fallback", () => {
    it("produces two step lines even when only home team has shots", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.3, minute: 20, period: 1 }),
        makeShot({ id: "s2", teamId: HOME, xg: 0.15, minute: 55, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.stepLines).toHaveLength(2);
      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;

      expect(homeLine).toBeDefined();
      expect(awayLine).toBeDefined();
      expect(homeLine.totalXg).toBeCloseTo(0.45);
      expect(awayLine.totalXg).toBe(0);
    });

    it("produces two step lines even when only away team has shots", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: AWAY, xg: 0.22, minute: 35, period: 1 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.stepLines).toHaveLength(2);
      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;

      expect(homeLine.totalXg).toBe(0);
      expect(awayLine.totalXg).toBeCloseTo(0.22);
    });

    it("away line is flat (all cumXg = 0) when only home has shots", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.5, minute: 50, period: 2 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;
      for (const point of awayLine.points) {
        expect(point.cumXg).toBe(0);
      }
    });

    it("two end labels are still present in one-team scenario", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.35, minute: 22, period: 1 }),
      ];

      const model = computeXGTimeline({ shots, homeTeam: HOME, awayTeam: AWAY });

      expect(model.endLabels).toHaveLength(2);
      expect(model.endLabels.find((l) => l.teamId === HOME)!.text).toBe("0.35");
      expect(model.endLabels.find((l) => l.teamId === AWAY)!.text).toBe("0.00");
    });
  });

  // ---- mirrored layout -----------------------------------------------------

  describe("mirrored layout", () => {
    it("away team step line goes below zero (higher cy = lower on screen)", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 0.5, minute: 20, period: 1 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.4, minute: 40, period: 1 }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        layout: "mirrored",
      });

      const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
      const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;

      // Zero line cy (both start here)
      const zeroCy = homeLine.points[0]!.cy;

      // Home line should go ABOVE zero (lower cy in SVG)
      const homeLastStep = homeLine.points.find((p) => p.cumXg > 0);
      expect(homeLastStep!.cy).toBeLessThan(zeroCy);

      // Away line should go BELOW zero (higher cy in SVG)
      const awayLastStep = awayLine.points.find((p) => p.cumXg > 0);
      expect(awayLastStep!.cy).toBeGreaterThan(zeroCy);
    });

    it("y-axis domain spans negative to positive in mirrored mode", () => {
      const shots: Shot[] = [
        makeShot({ id: "s1", teamId: HOME, xg: 1.0, minute: 30, period: 1 }),
        makeShot({ id: "s2", teamId: AWAY, xg: 0.8, minute: 60, period: 2 }),
      ];

      const model = computeXGTimeline({
        shots,
        homeTeam: HOME,
        awayTeam: AWAY,
        layout: "mirrored",
      });

      expect(model.axes.y.domain[0]).toBeLessThan(0);
      expect(model.axes.y.domain[1]).toBeGreaterThan(0);
    });
  });

  // ---- single shot --------------------------------------------------------

  it("renders a valid chart from a single shot", () => {
    const shots: Shot[] = [
      makeShot({ id: "s1", teamId: HOME, xg: 0.42, minute: 55, period: 2 }),
    ];

    const model = computeXGTimeline({
      shots,
      homeTeam: HOME,
      awayTeam: AWAY,
    });

    expect(model.meta.empty).toBe(false);
    expect(model.meta.validShots).toBe(1);
    expect(model.emptyState).toBeNull();

    // Layout — frame is the outer rect (MARGIN-derived); plotArea is
    // inset by the default axisPadding ([0, 6]) for marker clearance.
    expect(model.layout.viewBox).toEqual({ width: 560, height: 320 });
    expect(model.layout.frame.x).toBe(50); // MARGIN.left
    expect(model.layout.frame.y).toBe(20); // MARGIN.top
    expect(model.layout.plotArea.x).toBe(50); // gutterX=0
    expect(model.layout.plotArea.y).toBe(26); // MARGIN.top + gutterY=6

    // Step lines: both teams should be present
    expect(model.stepLines).toHaveLength(2);
    const homeLine = model.stepLines.find((l) => l.teamId === HOME)!;
    const awayLine = model.stepLines.find((l) => l.teamId === AWAY)!;

    expect(homeLine.totalXg).toBeCloseTo(0.42);
    expect(awayLine.totalXg).toBe(0);
    expect(homeLine.path).toContain("M");
    expect(homeLine.path).toContain("H");
    expect(awayLine.path).toContain("M");

    // Points: home line should have origin + step-before + step-after + end = 4 points
    expect(homeLine.points.length).toBeGreaterThanOrEqual(4);
    expect(homeLine.points[0]!.minute).toBe(0);
    expect(homeLine.points[0]!.cumXg).toBe(0);
    expect(homeLine.points[homeLine.points.length - 1]!.minute).toBe(90);
    expect(homeLine.points[homeLine.points.length - 1]!.cumXg).toBeCloseTo(0.42);

    // Away line: flat from 0 to 0
    expect(awayLine.points[0]!.cumXg).toBe(0);
    expect(awayLine.points[awayLine.points.length - 1]!.cumXg).toBe(0);

    // End labels for both teams
    expect(model.endLabels).toHaveLength(2);
    expect(model.endLabels.find((l) => l.teamId === HOME)!.text).toBe("0.42");
    expect(model.endLabels.find((l) => l.teamId === AWAY)!.text).toBe("0.00");

    // Axes
    expect(model.axes.x.domain[0]).toBe(0);
    expect(model.axes.x.domain[1]).toBe(90);
    expect(model.axes.x.ticks).toContain(0);
    expect(model.axes.x.ticks).toContain(45);
    expect(model.axes.x.ticks).toContain(90);

    expect(model.axes.y.domain[0]).toBe(0);
    expect(model.axes.y.domain[1]).toBeGreaterThanOrEqual(0.42);

    // Guides: at least HT and FT
    expect(model.guides.length).toBeGreaterThanOrEqual(2);
    expect(model.guides.find((g) => g.label === "HT")).toBeDefined();
    expect(model.guides.find((g) => g.label === "FT")).toBeDefined();

    // Markers: 1 shot dot for the single shot
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0]!.xg).toBeCloseTo(0.42);
    expect(model.markers[0]!.teamId).toBe(HOME);

    // Accessible label
    expect(model.meta.accessibleLabel).toContain("xG timeline");
    expect(model.meta.accessibleLabel).toContain(HOME);
    expect(model.meta.accessibleLabel).toContain(AWAY);
  });
});
