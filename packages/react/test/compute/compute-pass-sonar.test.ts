import { describe, expect, test } from "vitest";

import type { PassEvent } from "@withqwerty/campos-schema";

import {
  assignAngularBin,
  bearingLabel,
  computePassSonar,
  DEFAULT_PASS_SONAR_BIN_COUNT,
  formatPassSonarWarning,
} from "../../src/compute/pass-sonar.js";

let nextId = 0;

function makePass(opts: Partial<PassEvent>): PassEvent {
  nextId += 1;
  return {
    kind: "pass",
    id: opts.id ?? `p-${nextId}`,
    matchId: opts.matchId ?? "m-1",
    teamId: opts.teamId ?? "t-1",
    playerId: opts.playerId ?? "pl-1",
    playerName: opts.playerName ?? null,
    minute: opts.minute ?? 0,
    addedMinute: opts.addedMinute ?? null,
    second: opts.second ?? 0,
    period: opts.period ?? 1,
    x: opts.x ?? null,
    y: opts.y ?? null,
    endX: opts.endX ?? null,
    endY: opts.endY ?? null,
    length: opts.length ?? null,
    angle: opts.angle ?? null,
    recipient: opts.recipient ?? null,
    passType: opts.passType ?? null,
    passResult: opts.passResult ?? null,
    isAssist: opts.isAssist ?? false,
    provider: opts.provider ?? "test",
    providerEventId: opts.providerEventId ?? `${nextId}`,
  };
}

// Convenience: build a pass at origin (50, 50) with end displaced by (dx, dy)
// in Campos canonical units. Default passResult is "complete".
function passAt(
  dx: number,
  dy: number,
  passResult: PassEvent["passResult"] = "complete",
) {
  return makePass({ x: 50, y: 50, endX: 50 + dx, endY: 50 + dy, passResult });
}

describe("assignAngularBin (binCount=8)", () => {
  test("forward bin (binIndex=0) for angle 0 (+x)", () => {
    expect(assignAngularBin(0, 8)).toBe(0);
  });
  test("forward bin owns the lower-closed boundary -π/8", () => {
    expect(assignAngularBin(-Math.PI / 8, 8)).toBe(0);
  });
  test("forward-left bin (binIndex=1) for angle +π/4", () => {
    expect(assignAngularBin(Math.PI / 4, 8)).toBe(1);
  });
  test("forward-left bin owns the lower-closed boundary +π/8", () => {
    expect(assignAngularBin(Math.PI / 8, 8)).toBe(1);
  });
  test("left bin (binIndex=2) for angle +π/2", () => {
    expect(assignAngularBin(Math.PI / 2, 8)).toBe(2);
  });
  test("back bin (binIndex=4) for angle +π via wrap-around", () => {
    expect(assignAngularBin(Math.PI, 8)).toBe(4);
  });
  test("back bin owns angles slightly less than +π", () => {
    expect(assignAngularBin(Math.PI - 0.01, 8)).toBe(4);
  });
  test("back bin owns angles slightly more than -π (wrap)", () => {
    expect(assignAngularBin(-Math.PI + 0.01, 8)).toBe(4);
  });
  test("right bin (binIndex=6) for angle -π/2", () => {
    expect(assignAngularBin(-Math.PI / 2, 8)).toBe(6);
  });
  test("forward-right bin (binIndex=7) for angle -π/4", () => {
    expect(assignAngularBin(-Math.PI / 4, 8)).toBe(7);
  });
});

describe("assignAngularBin (binCount=24)", () => {
  test("forward bin (binIndex=0) for angle 0", () => {
    expect(assignAngularBin(0, 24)).toBe(0);
  });
  test("forward bin owns the lower-closed boundary -π/24", () => {
    expect(assignAngularBin(-Math.PI / 24, 24)).toBe(0);
  });
  test("15° (π/12) bins as binIndex=1", () => {
    expect(assignAngularBin(Math.PI / 12, 24)).toBe(1);
  });
  test("45° (π/4) bins as binIndex=3 (forward-left inter-cardinal)", () => {
    expect(assignAngularBin(Math.PI / 4, 24)).toBe(3);
  });
  test("90° (π/2) bins as binIndex=6 (left cardinal)", () => {
    expect(assignAngularBin(Math.PI / 2, 24)).toBe(6);
  });
  test("180° (π) bins as binIndex=12 (back cardinal)", () => {
    expect(assignAngularBin(Math.PI, 24)).toBe(12);
  });
  test("defaults to 24-bin when binCount is omitted", () => {
    expect(assignAngularBin(0)).toBe(0);
    expect(assignAngularBin(Math.PI / 12)).toBe(1);
  });
});

describe("assignAngularBin (binCount=12)", () => {
  test("forward bin (binIndex=0) for angle 0", () => {
    expect(assignAngularBin(0, 12)).toBe(0);
  });
  test("30° (π/6) bins as binIndex=1", () => {
    expect(assignAngularBin(Math.PI / 6, 12)).toBe(1);
  });
  test("90° (π/2) bins as binIndex=3 (left cardinal)", () => {
    expect(assignAngularBin(Math.PI / 2, 12)).toBe(3);
  });
  test("180° (π) bins as binIndex=6 (back cardinal)", () => {
    expect(assignAngularBin(Math.PI, 12)).toBe(6);
  });
});

describe("bearingLabel", () => {
  test("returns canonical name for each of the eight canonical centres", () => {
    expect(bearingLabel(0)).toBe("forward");
    expect(bearingLabel(Math.PI / 4)).toBe("forward-left");
    expect(bearingLabel(Math.PI / 2)).toBe("left");
    expect(bearingLabel((3 * Math.PI) / 4)).toBe("back-left");
    expect(bearingLabel(Math.PI)).toBe("back");
    expect(bearingLabel(-Math.PI)).toBe("back");
    expect(bearingLabel((-3 * Math.PI) / 4)).toBe("back-right");
    expect(bearingLabel(-Math.PI / 2)).toBe("right");
    expect(bearingLabel(-Math.PI / 4)).toBe("forward-right");
  });
  test("returns degree label with 'left' suffix for positive non-canonical angles", () => {
    // +15° (π/12) is not a canonical centre; positive = attacker's left.
    expect(bearingLabel(Math.PI / 12)).toBe("15° left");
    expect(bearingLabel(Math.PI / 6)).toBe("30° left");
  });
  test("returns degree label with 'right' suffix for negative non-canonical angles", () => {
    expect(bearingLabel(-Math.PI / 12)).toBe("15° right");
    expect(bearingLabel(-Math.PI / 6)).toBe("30° right");
  });
});

describe("computePassSonar — passResult semantics", () => {
  test("complete counts attempted and completed", () => {
    const model = computePassSonar({ passes: [passAt(10, 0, "complete")] });
    expect(model.summary).toEqual({ attempted: 1, completed: 1, completionRate: 1 });
  });
  test("incomplete counts attempted only", () => {
    const model = computePassSonar({ passes: [passAt(10, 0, "incomplete")] });
    expect(model.summary).toEqual({ attempted: 1, completed: 0, completionRate: 0 });
  });
  test("offside counts attempted only", () => {
    const model = computePassSonar({ passes: [passAt(10, 0, "offside")] });
    expect(model.summary.attempted).toBe(1);
    expect(model.summary.completed).toBe(0);
  });
  test("out counts attempted only", () => {
    const model = computePassSonar({ passes: [passAt(10, 0, "out")] });
    expect(model.summary.attempted).toBe(1);
    expect(model.summary.completed).toBe(0);
  });
  test("null is dropped with kind=missing-result warning", () => {
    const model = computePassSonar({ passes: [passAt(10, 0, null)] });
    expect(model.summary.attempted).toBe(0);
    expect(model.meta.structuredWarnings).toEqual([{ kind: "missing-result", count: 1 }]);
  });
  test("totals: 5 complete + 3 incomplete + 1 offside + 1 out = 10 attempted, 5 completed", () => {
    const passes = [
      ...Array.from({ length: 5 }, () => passAt(10, 0, "complete")),
      ...Array.from({ length: 3 }, () => passAt(10, 0, "incomplete")),
      passAt(10, 0, "offside"),
      passAt(10, 0, "out"),
    ];
    const model = computePassSonar({ passes });
    expect(model.summary.attempted).toBe(10);
    expect(model.summary.completed).toBe(5);
    expect(model.summary.completionRate).toBeCloseTo(0.5);
  });
});

describe("computePassSonar — direction binning (binCount=8)", () => {
  test("forward (+x toward opposition goal) bins as 'forward'", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], binCount: 8 });
    const wedge = model.wedges[0]!;
    expect(wedge.label).toBe("forward");
    expect(wedge.attempted).toBe(1);
  });
  test("backward (-x toward own goal) bins as 'back'", () => {
    const model = computePassSonar({ passes: [passAt(-10, 0)], binCount: 8 });
    expect(model.wedges[4]!.label).toBe("back");
    expect(model.wedges[4]!.attempted).toBe(1);
  });
  test("toward attacker's left (+y) bins as 'left'", () => {
    const model = computePassSonar({ passes: [passAt(0, 10)], binCount: 8 });
    expect(model.wedges[2]!.label).toBe("left");
    expect(model.wedges[2]!.attempted).toBe(1);
  });
  test("toward attacker's right (-y) bins as 'right'", () => {
    const model = computePassSonar({ passes: [passAt(0, -10)], binCount: 8 });
    expect(model.wedges[6]!.label).toBe("right");
    expect(model.wedges[6]!.attempted).toBe(1);
  });
  test("8 contiguous non-overlapping bins are present in canonical order", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], binCount: 8 });
    expect(model.wedges).toHaveLength(8);
    expect(model.wedges.map((w) => w.label)).toEqual([
      "forward",
      "forward-left",
      "left",
      "back-left",
      "back",
      "back-right",
      "right",
      "forward-right",
    ]);
    // All 8 wedges are canonical in the 8-bin layout.
    expect(model.wedges.every((w) => w.isCanonical)).toBe(true);
  });
});

describe("computePassSonar — bin count defaults and variants", () => {
  test("default binCount is 24 (matches DEFAULT_PASS_SONAR_BIN_COUNT)", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)] });
    expect(DEFAULT_PASS_SONAR_BIN_COUNT).toBe(24);
    expect(model.meta.binCount).toBe(24);
    expect(model.wedges).toHaveLength(24);
  });
  test("binCount=12 produces 12 wedges with 4 canonical (forward/left/back/right)", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], binCount: 12 });
    expect(model.wedges).toHaveLength(12);
    expect(model.meta.binCount).toBe(12);
    const canonicals = model.wedges.filter((w) => w.isCanonical);
    // At 30° spacing, only the four primary cardinals coincide with bin centres.
    expect(canonicals.map((w) => w.label)).toEqual(["forward", "left", "back", "right"]);
  });
  test("binCount=24 produces 24 wedges with 8 canonical (all cardinals + inter-cardinals)", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], binCount: 24 });
    expect(model.wedges).toHaveLength(24);
    const canonicals = model.wedges.filter((w) => w.isCanonical);
    expect(canonicals).toHaveLength(8);
    expect(canonicals.map((w) => w.label).sort()).toEqual(
      [
        "back",
        "back-left",
        "back-right",
        "forward",
        "forward-left",
        "forward-right",
        "left",
        "right",
      ].sort(),
    );
  });
  test("binCount=24 non-canonical bins get degree labels", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], binCount: 24 });
    // binIndex=1 sits 15° CCW from forward (+y side = attacker's left).
    expect(model.wedges[1]!.label).toBe("15° left");
    expect(model.wedges[1]!.isCanonical).toBe(false);
    // binIndex=23 sits 15° CW from forward (attacker's right).
    expect(model.wedges[23]!.label).toBe("15° right");
  });
  test("forward bin is always binIndex=0 with label 'forward' regardless of binCount", () => {
    for (const binCount of [8, 12, 24] as const) {
      const model = computePassSonar({ passes: [passAt(10, 0)], binCount });
      expect(model.wedges[0]!.label).toBe("forward");
      expect(model.wedges[0]!.attempted).toBe(1);
    }
  });
});

describe("computePassSonar — missing coordinates", () => {
  test("x null is dropped with kind=missing-coords warning", () => {
    const model = computePassSonar({
      passes: [makePass({ x: null, y: 50, endX: 60, endY: 50, passResult: "complete" })],
    });
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "missing-coords",
      count: 1,
    });
  });
  test("endY null is dropped", () => {
    const model = computePassSonar({
      passes: [makePass({ x: 50, y: 50, endX: 60, endY: null, passResult: "complete" })],
    });
    expect(model.summary.attempted).toBe(0);
  });
  test("warning count aggregates across multiple drops", () => {
    const passes = [
      makePass({ x: null, y: 50, endX: 60, endY: 50, passResult: "complete" }),
      makePass({ x: 50, y: null, endX: 60, endY: 50, passResult: "complete" }),
      makePass({ x: 50, y: 50, endX: null, endY: 50, passResult: "complete" }),
    ];
    const model = computePassSonar({ passes });
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "missing-coords",
      count: 3,
    });
  });
});

describe("computePassSonar — subject enforcement", () => {
  test("no subjectId: all passes accepted", () => {
    const passes = [
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "a",
      }),
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "b",
      }),
    ];
    const model = computePassSonar({ passes });
    expect(model.summary.attempted).toBe(2);
    expect(model.meta.structuredWarnings).toEqual([]);
  });
  test("subjectId set with subjectKind=player drops mismatches", () => {
    const passes = [
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "a",
      }),
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "b",
      }),
    ];
    const model = computePassSonar({ passes, subjectId: "a" });
    expect(model.summary.attempted).toBe(1);
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "subject-mismatch",
      count: 1,
      expected: "a",
    });
  });
  test("subjectId set with subjectKind=team drops by teamId", () => {
    const passes = [
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        teamId: "home",
      }),
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        teamId: "away",
      }),
    ];
    const model = computePassSonar({
      passes,
      subjectId: "home",
      subjectKind: "team",
    });
    expect(model.summary.attempted).toBe(1);
  });
  test("zero matches: meta.empty true and warnings record mismatches", () => {
    const passes = [
      makePass({
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
        passResult: "complete",
        playerId: "a",
      }),
    ];
    const model = computePassSonar({ passes, subjectId: "z" });
    expect(model.meta.empty).toBe(true);
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "subject-mismatch",
      count: 1,
      expected: "z",
    });
  });
});

describe("computePassSonar — scaleMaxAttempts validation", () => {
  test("undefined: chart auto-scales to observed max", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0), passAt(10, 0), passAt(10, 0)],
    });
    expect(model.meta.requestedScaleMax).toBeNull();
    expect(model.meta.resolvedScaleMax).toBe(3);
  });
  test("0 → invalid warning, treat as auto-scale", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], scaleMaxAttempts: 0 });
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "scale-max-invalid",
      received: 0,
    });
    expect(model.meta.resolvedScaleMax).toBe(1);
  });
  test("-5 → invalid warning", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)], scaleMaxAttempts: -5 });
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "scale-max-invalid",
      received: -5,
    });
  });
  test("NaN → invalid warning", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0)],
      scaleMaxAttempts: Number.NaN,
    });
    expect(
      model.meta.structuredWarnings.some((w) => w.kind === "scale-max-invalid"),
    ).toBe(true);
  });
  test("Infinity → invalid warning", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0)],
      scaleMaxAttempts: Number.POSITIVE_INFINITY,
    });
    expect(
      model.meta.structuredWarnings.some((w) => w.kind === "scale-max-invalid"),
    ).toBe(true);
  });
  test("3.7 → ceil to 4, no warning", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0), passAt(10, 0), passAt(10, 0)],
      scaleMaxAttempts: 3.7,
    });
    expect(model.meta.resolvedScaleMax).toBe(4);
    expect(
      model.meta.structuredWarnings.some((w) => w.kind === "scale-max-invalid"),
    ).toBe(false);
  });
  test("integer >= observedMax: no warning, used as resolvedMax", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0), passAt(10, 0)],
      scaleMaxAttempts: 5,
    });
    expect(model.meta.resolvedScaleMax).toBe(5);
    expect(model.meta.structuredWarnings).toEqual([]);
  });
  test("integer < observedMax: clamped warning recorded", () => {
    const passes = Array.from({ length: 7 }, () => passAt(10, 0));
    const model = computePassSonar({ passes, scaleMaxAttempts: 3 });
    expect(model.meta.structuredWarnings).toContainEqual({
      kind: "scale-max-clamped",
      observedMax: 7,
      resolvedMax: 3,
    });
    // Clamped wedge stays at radius 1 (max).
    expect(model.wedges[0]!.attemptedRadius).toBeCloseTo(1);
  });
  test("requestedScaleMax preserved verbatim in meta", () => {
    const model = computePassSonar({
      passes: [passAt(10, 0)],
      scaleMaxAttempts: 3.7,
    });
    expect(model.meta.requestedScaleMax).toBe(3.7);
  });
});

describe("computePassSonar — model shape", () => {
  test("empty input (default binCount=24) → meta.empty true, summary zeros, no wedges populated", () => {
    const model = computePassSonar({ passes: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.meta.binCount).toBe(24);
    expect(model.summary).toEqual({ attempted: 0, completed: 0, completionRate: 0 });
    expect(model.wedges.every((w) => w.attempted === 0 && w.completed === 0)).toBe(true);
  });
  test("single pass → exactly one wedge has attempted > 0 (at any binCount)", () => {
    for (const binCount of [8, 12, 24] as const) {
      const model = computePassSonar({ passes: [passAt(10, 0)], binCount });
      const populated = model.wedges.filter((w) => w.attempted > 0);
      expect(populated).toHaveLength(1);
    }
  });
  test("legend.rows has exactly two rows (attempted + completed)", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)] });
    expect(model.legend.rows).toHaveLength(2);
    expect(model.legend.rows.map((r) => r.kind)).toEqual(["attempted", "completed"]);
  });
  test("attemptedRadius and completedRadius are in [0, 1]", () => {
    const passes = Array.from({ length: 6 }, () => passAt(10, 0, "complete"));
    const model = computePassSonar({ passes });
    for (const wedge of model.wedges) {
      expect(wedge.attemptedRadius).toBeGreaterThanOrEqual(0);
      expect(wedge.attemptedRadius).toBeLessThanOrEqual(1);
      expect(wedge.completedRadius).toBeGreaterThanOrEqual(0);
      expect(wedge.completedRadius).toBeLessThanOrEqual(1);
    }
  });
  test("completionRate is 0 when attempted is 0, NaN-safe", () => {
    const model = computePassSonar({ passes: [] });
    expect(model.wedges[0]!.completionRate).toBe(0);
    expect(model.summary.completionRate).toBe(0);
  });
  test("averageLength is null on a wedge with zero attempted, otherwise mean of input length (binCount=8)", () => {
    const passes = [
      makePass({ x: 50, y: 50, endX: 60, endY: 50, length: 10, passResult: "complete" }),
      makePass({ x: 50, y: 50, endX: 60, endY: 50, length: 30, passResult: "complete" }),
    ];
    const model = computePassSonar({ passes, binCount: 8 });
    expect(model.wedges[0]!.averageLength).toBeCloseTo(20);
    // wedges[2] is 'left' at binCount=8; no passes in that direction here.
    expect(model.wedges[2]!.averageLength).toBeNull();
  });
  test("averageLength recomputed when length is null on input (Math.hypot fallback)", () => {
    // dx=5, dy=0 → angle=0, bins as 'forward' (wedge 0) at every binCount.
    const passes = [
      makePass({
        x: 50,
        y: 50,
        endX: 55,
        endY: 50,
        length: null,
        passResult: "complete",
      }),
    ];
    const model = computePassSonar({ passes });
    expect(model.wedges[0]!.averageLength).toBeCloseTo(5);
  });
  test("resolvedScaleMax is always >= 1, integer, finite", () => {
    const empty = computePassSonar({ passes: [] });
    expect(empty.meta.resolvedScaleMax).toBe(1);
    const populated = computePassSonar({
      passes: Array.from({ length: 4 }, () => passAt(10, 0)),
    });
    expect(populated.meta.resolvedScaleMax).toBe(4);
  });
});

describe("computePassSonar — warnings dedup and formatting", () => {
  test("warnings array is empty when no drops/clamps occurred", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)] });
    expect(model.meta.warnings).toEqual([]);
    expect(model.meta.structuredWarnings).toEqual([]);
  });
  test("multiple drops of the same kind merge into one structured warning with summed count", () => {
    const passes = [
      makePass({ x: null, y: 50, endX: 60, endY: 50, passResult: "complete" }),
      makePass({ x: null, y: 50, endX: 60, endY: 50, passResult: "complete" }),
    ];
    const model = computePassSonar({ passes });
    const missingCoords = model.meta.structuredWarnings.filter(
      (w) => w.kind === "missing-coords",
    );
    expect(missingCoords).toHaveLength(1);
    expect(missingCoords[0]).toEqual({ kind: "missing-coords", count: 2 });
  });
  test("warnings string array mirrors structuredWarnings via formatPassSonarWarning", () => {
    const passes = [
      makePass({ x: null, y: 50, endX: 60, endY: 50, passResult: "complete" }),
    ];
    const model = computePassSonar({ passes });
    expect(model.meta.warnings).toEqual([
      formatPassSonarWarning({ kind: "missing-coords", count: 1 }),
    ]);
  });
});

describe("formatPassSonarWarning", () => {
  test("missing-coords singular vs plural", () => {
    expect(formatPassSonarWarning({ kind: "missing-coords", count: 1 })).toContain(
      "1 pass with",
    );
    expect(formatPassSonarWarning({ kind: "missing-coords", count: 3 })).toContain(
      "3 passes with",
    );
  });
  test("scale-max-clamped includes both numbers", () => {
    const text = formatPassSonarWarning({
      kind: "scale-max-clamped",
      observedMax: 7,
      resolvedMax: 3,
    });
    expect(text).toContain("3");
    expect(text).toContain("7");
  });
});

describe("computePassSonar — lengthBy and lengthRadius", () => {
  test("default lengthBy is 'count' and lengthRadius still reflects mean length", () => {
    const passes = [
      passAt(10, 0), // forward, len 10
      passAt(20, 0), // forward, len 20
    ];
    const model = computePassSonar({ passes });
    expect(model.meta.lengthBy).toBe("count");
    const forward = model.wedges.find((w) => w.binIndex === 0);
    expect(forward?.averageLength).toBeCloseTo(15, 6);
    // With lengthBy: "count" the rendered radius tracks attempts, not length,
    // but `lengthRadius` is still exposed so a renderer could pick it up.
    expect(forward?.attemptedRadius).toBeCloseTo(1, 6);
    expect(forward?.lengthRadius).toBeGreaterThan(0);
  });

  test("scaleMaxLength caps lengthRadius and emits clamp warning", () => {
    const passes = [passAt(60, 0)]; // forward, len 60
    const model = computePassSonar({
      passes,
      lengthBy: "mean-length",
      scaleMaxLength: 30,
    });
    const forward = model.wedges.find((w) => w.binIndex === 0);
    // clamped to 30 → lengthClamped = 30 → sqrt(30/30) = 1
    expect(forward?.lengthRadius).toBeCloseTo(1, 6);
    const kinds = model.meta.structuredWarnings.map((w) => w.kind);
    expect(kinds).toContain("scale-max-length-clamped");
  });

  test("scaleMaxLength=0 is invalid and falls back to the observed max", () => {
    const passes = [passAt(20, 0)];
    const model = computePassSonar({
      passes,
      lengthBy: "mean-length",
      scaleMaxLength: 0,
    });
    const kinds = model.meta.structuredWarnings.map((w) => w.kind);
    expect(kinds).toContain("scale-max-length-invalid");
    // Observed-max fallback keeps the max-length wedge at the top of the track.
    const forward = model.wedges.find((w) => w.binIndex === 0);
    expect(forward?.lengthRadius).toBeCloseTo(1, 6);
  });
});

describe("computePassSonar — metricForPass", () => {
  test("per-bin metricValue is the mean of the extracted values, null when absent", () => {
    const passes = [
      passAt(10, 0), // forward
      passAt(10, 0), // forward
      passAt(0, 10), // left
    ];
    const model = computePassSonar({
      passes,
      metricForPass: (pass) => (pass.endY === 50 ? 0.2 : -0.1),
    });
    const forward = model.wedges.find((w) => w.binIndex === 0);
    const left = model.wedges.find((w) => w.label === "left");
    expect(forward?.metricValue).toBeCloseTo(0.2, 6);
    expect(left?.metricValue).toBeCloseTo(-0.1, 6);
    // Other bins are empty → metricValue is null, not 0.
    const empty = model.wedges.find((w) => w.attempted === 0);
    expect(empty?.metricValue).toBeNull();
    // Range reflects the non-null values.
    expect(model.meta.metricRange).toEqual({ min: -0.1, max: 0.2 });
  });

  test("metricRange is null when no metric is provided", () => {
    const model = computePassSonar({ passes: [passAt(10, 0)] });
    expect(model.meta.metricRange).toBeNull();
  });

  test("metricRange is null when every metric call returns null (no finite bin mean)", () => {
    const passes = [passAt(10, 0), passAt(0, 10), passAt(-10, 0)];
    const model = computePassSonar({ passes, metricForPass: () => null });
    expect(model.meta.metricRange).toBeNull();
    for (const wedge of model.wedges) {
      expect(wedge.metricValue).toBeNull();
    }
  });

  test("non-finite and null metric returns are skipped without affecting the mean", () => {
    const passes = [passAt(10, 0), passAt(10, 0), passAt(10, 0)];
    let i = 0;
    const model = computePassSonar({
      passes,
      metricForPass: () => {
        i += 1;
        if (i === 1) return 0.2;
        if (i === 2) return null;
        return Number.NaN;
      },
    });
    const forward = model.wedges.find((w) => w.binIndex === 0);
    // Only the 0.2 contribution counted.
    expect(forward?.metricValue).toBeCloseTo(0.2, 6);
  });
});

describe("computeSharedScaleMax", () => {
  test("count mode returns the busiest bin count across every cell", async () => {
    const { computeSharedScaleMax } = await import("../../src/compute/pass-sonar.js");
    const a = [passAt(10, 0), passAt(10, 0), passAt(10, 0)];
    const b = [passAt(0, 10), passAt(0, 10)];
    expect(
      computeSharedScaleMax([{ passes: a }, { passes: b }], { metric: "count" }),
    ).toBe(3);
  });

  test("length mode returns the biggest mean-length across every bin of every cell", async () => {
    const { computeSharedScaleMax } = await import("../../src/compute/pass-sonar.js");
    const a = [passAt(10, 0), passAt(20, 0)]; // forward mean = 15
    const b = [passAt(0, 40)]; // left mean = 40
    expect(
      computeSharedScaleMax([{ passes: a }, { passes: b }], { metric: "length" }),
    ).toBeCloseTo(40, 6);
  });

  test("empty input returns 0", async () => {
    const { computeSharedScaleMax } = await import("../../src/compute/pass-sonar.js");
    expect(computeSharedScaleMax([], { metric: "count" })).toBe(0);
    expect(
      computeSharedScaleMax([{ passes: [] }, { passes: [] }], { metric: "length" }),
    ).toBe(0);
  });

  test("subjectId + subjectKind filter scopes the aggregation per cell", async () => {
    const { computeSharedScaleMax } = await import("../../src/compute/pass-sonar.js");
    // Cell A has three forward passes from player "p1" and two from "p2".
    // Scoping to "p1" means the busiest bin across the grid is 3, not 5.
    const mix = [
      { ...passAt(10, 0), playerId: "p1" },
      { ...passAt(10, 0), playerId: "p1" },
      { ...passAt(10, 0), playerId: "p1" },
      { ...passAt(10, 0), playerId: "p2" },
      { ...passAt(10, 0), playerId: "p2" },
    ];
    expect(
      computeSharedScaleMax(
        [
          { passes: mix, subjectId: "p1", subjectKind: "player" },
          { passes: mix, subjectId: "p2", subjectKind: "player" },
        ],
        { metric: "count" },
      ),
    ).toBe(3);
  });

  test("lengthBy=mean-length with all-zero length passes does not produce NaN radii", () => {
    // Degenerate "self-passes" (endX==x, endY==y) have length 0. The
    // compute layer must still produce finite lengthRadius values.
    const passes = [
      { ...passAt(0, 0), endX: 50, endY: 50 },
      { ...passAt(0, 0), endX: 50, endY: 50 },
    ];
    const model = computePassSonar({ passes, lengthBy: "mean-length" });
    for (const wedge of model.wedges) {
      expect(Number.isFinite(wedge.lengthRadius)).toBe(true);
    }
  });
});
