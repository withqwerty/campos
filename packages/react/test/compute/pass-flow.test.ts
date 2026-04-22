import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import type { PassEvent } from "@withqwerty/campos-schema";

import {
  computePassFlow,
  InvalidEdgesError,
  type ComputePassFlowInput,
} from "../../src/compute/pass-flow.js";

const BASELINE_FIXTURE_PATH = path.join(
  import.meta.dirname,
  "../fixtures/pass-flow.baseline.json",
);

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function makePass(overrides: Partial<PassEvent> = {}): PassEvent {
  idCounter += 1;
  const base: PassEvent = {
    kind: "pass",
    id: `p${idCounter}`,
    matchId: "m1",
    teamId: "t1",
    playerId: null,
    playerName: null,
    minute: 10,
    addedMinute: null,
    second: 0,
    period: 1,
    x: 50,
    y: 50,
    endX: 60,
    endY: 50,
    length: 10,
    angle: 0,
    recipient: null,
    passType: "ground",
    passResult: "complete",
    isAssist: false,
    provider: "statsbomb",
    providerEventId: `prov-${idCounter}`,
  } as PassEvent;
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Empty & happy path
// ---------------------------------------------------------------------------

describe("computePassFlow — empty & happy path", () => {
  it("emits emptyState and no legend when passes is empty", () => {
    const model = computePassFlow({ passes: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No passes to chart" });
    expect(model.legend).toBeNull();
    expect(model.headerStats).toBeNull();
    expect(model.grid.bins).toHaveLength(6 * 4); // default grid still returns bins
    expect(model.grid.bins.every((bin) => bin.count === 0 && bin.opacity === 0)).toBe(
      true,
    );
  });

  it("bins a single pass into the correct cell with R=1 but gated (n=1)", () => {
    // x=55, y=25, endX=80, endY=25 → origin in col 3, row 1 of 6x4.
    const model = computePassFlow({
      passes: [makePass({ x: 55, y: 25, endX: 80, endY: 25 })],
    });
    const hit = model.grid.bins.find((bin) => bin.count > 0);
    expect(hit).toBeDefined();
    expect(hit!.count).toBe(1);
    expect(hit!.directionCount).toBe(1);
    // Single-pass bin: n<minCountForArrow → no arrow, but R still reported.
    expect(hit!.hasArrow).toBe(false);
    expect(hit!.lowDispersion).toBe(true);
    expect(hit!.resultantLength).toBeCloseTo(1, 10);
  });

  it("renders an arrow once count ≥ minCountForArrow and R ≥ dispersionFloor", () => {
    const passes = Array.from({ length: 5 }, () =>
      makePass({ x: 55, y: 25, endX: 80, endY: 25 }),
    );
    const model = computePassFlow({ passes });
    const hit = model.grid.bins.find((bin) => bin.count > 0)!;
    expect(hit.count).toBe(5);
    expect(hit.hasArrow).toBe(true);
    expect(hit.meanAngle).toBeCloseTo(0, 10);
    expect(hit.magnitudeHint).toBe(1); // default "equal" mode
    expect(hit.lowDispersion).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gating rules
// ---------------------------------------------------------------------------

describe("computePassFlow — gating", () => {
  it("gates antiparallel-pair bins (R≈0) to glyph regardless of count", () => {
    const passes = [
      makePass({ x: 55, y: 25, endX: 70, endY: 25 }),
      makePass({ x: 55, y: 25, endX: 40, endY: 25 }),
    ];
    const model = computePassFlow({ passes });
    const hit = model.grid.bins.find((bin) => bin.count > 0)!;
    expect(hit.count).toBe(2);
    expect(hit.hasArrow).toBe(false);
    expect(hit.meanAngle).toBeNull();
    expect(hit.resultantLength).toBeLessThan(1e-8);
    expect(hit.lowDispersion).toBe(true);
  });

  it("honours minCountForArrow override (n=1 allowed when set to 1)", () => {
    const model = computePassFlow({
      passes: [makePass({ x: 55, y: 25, endX: 80, endY: 25 })],
      minCountForArrow: 1,
    });
    const hit = model.grid.bins.find((bin) => bin.count > 0)!;
    expect(hit.hasArrow).toBe(true);
    expect(hit.meanAngle).toBeCloseTo(0, 10);
  });

  it("gates by dispersionFloor when R is below threshold", () => {
    // Two passes 90° apart → R = sqrt(2)/2 ≈ 0.707.
    const passes = [
      makePass({ x: 55, y: 25, endX: 80, endY: 25 }),
      makePass({ x: 55, y: 25, endX: 55, endY: 50 }),
    ];
    const model = computePassFlow({ passes, dispersionFloor: 0.8 });
    const hit = model.grid.bins.find((bin) => bin.count > 0)!;
    expect(hit.resultantLength).toBeCloseTo(Math.SQRT1_2, 4);
    expect(hit.hasArrow).toBe(false);
  });

  it("counts passes with missing endXY in `count` but not in `directionCount`", () => {
    const passes = [
      makePass({ x: 55, y: 25, endX: null, endY: null }),
      makePass({ x: 55, y: 25, endX: null, endY: null }),
      makePass({ x: 55, y: 25, endX: 80, endY: 25 }),
    ];
    const model = computePassFlow({ passes });
    const hit = model.grid.bins.find((bin) => bin.count > 0)!;
    expect(hit.count).toBe(3);
    expect(hit.directionCount).toBe(1);
    // Only one direction contributed; gate by n<minCountForArrow.
    expect(hit.hasArrow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Binning & edges
// ---------------------------------------------------------------------------

describe("computePassFlow — binning", () => {
  it("assigns passes on bin edges to the lower-index bin (except last edge)", () => {
    // With default 6 bins on x over [0,100], edges are at 0, 16.66, 33.33, …, 100.
    // x = 100 / 6 = 16.666… → exactly on edge 1 → bin index 1.
    const passes = [makePass({ x: 100 / 6, y: 50 }), makePass({ x: 100, y: 100 })];
    const model = computePassFlow({ passes, minCountForArrow: 1 });
    const topOfPitch = model.grid.bins.filter((b) => b.count > 0);
    // The (col=1, row=2) bin and the (col=5, row=3) bin should each contain one.
    const seen = new Set(topOfPitch.map((b) => `${b.col}:${b.row}`));
    expect(seen.has("1:2")).toBe(true);
    expect(seen.has("5:3")).toBe(true);
  });

  it("clamps out-of-range coordinates rather than dropping them", () => {
    const model = computePassFlow({
      passes: [makePass({ x: -5, y: 50 }), makePass({ x: 150, y: 50 })],
    });
    expect(model.meta.stats.clampedXY).toBe(2);
    const filled = model.grid.bins.filter((b) => b.count > 0);
    expect(filled.map((b) => b.col).sort()).toEqual([0, 5]);
  });

  it("drops passes with non-finite origin", () => {
    const model = computePassFlow({
      passes: [
        makePass({ x: null as unknown as number, y: 50 }),
        makePass({ x: 55, y: 50 }),
      ],
    });
    expect(model.meta.stats.droppedNonFinite).toBe(1);
    expect(model.meta.stats.totalValid).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Crop semantics
// ---------------------------------------------------------------------------

describe("computePassFlow — crop", () => {
  it("crop='half' drops passes in x < 50 regardless of attackingDirection", () => {
    const passes = [
      makePass({ x: 25, y: 50 }), // defensive half, dropped
      makePass({ x: 75, y: 50 }), // attacking half, kept
    ];
    for (const dir of ["right", "left", "up", "down"] as const) {
      const model = computePassFlow({ passes, crop: "half", attackingDirection: dir });
      expect(model.meta.stats.droppedOutOfCrop).toBe(1);
      expect(model.meta.stats.totalValid).toBe(1);
      // Bins span [50, 100] on x.
      expect(model.grid.bins.every((bin) => bin.x >= 50)).toBe(true);
    }
  });

  it("produces identical binning under all four attackingDirection values", () => {
    const passes = [
      makePass({ x: 60, y: 20 }),
      makePass({ x: 80, y: 80 }),
      makePass({ x: 95, y: 50 }),
    ];
    const models = (["right", "left", "up", "down"] as const).map((dir) =>
      computePassFlow({ passes, crop: "half", attackingDirection: dir }),
    );
    const [first, ...rest] = models;
    for (const m of rest) {
      expect(m.grid.bins.map((b) => b.count)).toEqual(
        first!.grid.bins.map((b) => b.count),
      );
      expect(m.grid.bins.map((b) => b.x)).toEqual(first!.grid.bins.map((b) => b.x));
      expect(m.grid.bins.map((b) => b.width)).toEqual(
        first!.grid.bins.map((b) => b.width),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Completion filter
// ---------------------------------------------------------------------------

describe("computePassFlow — completion filter", () => {
  const mixed: PassEvent[] = [
    makePass({ x: 55, y: 25, passResult: "complete" }),
    makePass({ x: 55, y: 25, passResult: "incomplete" }),
    makePass({ x: 55, y: 25, passResult: null }),
  ];

  it("default 'all' keeps every pass including null passResult", () => {
    const model = computePassFlow({ passes: mixed });
    expect(model.meta.stats.totalValid).toBe(3);
    expect(model.meta.stats.droppedNoOutcome).toBe(0);
  });

  it("'complete' drops non-complete passes and counts null-outcome separately", () => {
    const model = computePassFlow({ passes: mixed, completionFilter: "complete" });
    expect(model.meta.stats.totalValid).toBe(1);
    expect(model.meta.stats.droppedNoOutcome).toBe(1);
    expect(model.meta.stats.droppedByFilter).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Minute window
// ---------------------------------------------------------------------------

describe("computePassFlow — minute window", () => {
  it("filters by [minMinute, maxMinute] inclusive", () => {
    const passes = [
      makePass({ minute: 5 }),
      makePass({ minute: 30 }),
      makePass({ minute: 60 }),
    ];
    const model = computePassFlow({ passes, minMinute: 10, maxMinute: 45 });
    expect(model.meta.stats.totalValid).toBe(1);
    expect(model.meta.stats.droppedByFilter).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Explicit edges
// ---------------------------------------------------------------------------

describe("computePassFlow — explicit edges", () => {
  it("uses xEdges to produce non-uniform bins", () => {
    const passes = [makePass({ x: 10, y: 50 }), makePass({ x: 60, y: 50 })];
    const model = computePassFlow({
      passes,
      xEdges: [0, 25, 75, 100],
      yEdges: [0, 50, 100],
    });
    expect(model.grid.columns).toBe(3);
    expect(model.grid.rows).toBe(2);
    // 3×2 = 6 bins
    expect(model.grid.bins).toHaveLength(6);
    // first pass (x=10) → col 0, row 1 (bottom wedge y>=50 is row 1)
    // second pass (x=60) → col 1, row 1
    const byColRow = new Map(
      model.grid.bins.map((b) => [`${b.col}:${b.row}`, b] as const),
    );
    expect(byColRow.get("0:1")?.count).toBe(1);
    expect(byColRow.get("1:1")?.count).toBe(1);
  });

  it("throws InvalidEdgesError on non-monotonic edges", () => {
    expect(() => computePassFlow({ passes: [], xEdges: [0, 50, 40, 100] })).toThrow(
      InvalidEdgesError,
    );
  });

  it("throws InvalidEdgesError when first edge mismatches crop boundary", () => {
    expect(() =>
      computePassFlow({ passes: [], crop: "half", xEdges: [0, 75, 100] }),
    ).toThrow(InvalidEdgesError);
  });

  it("throws InvalidEdgesError when edges fall outside [0, 100]", () => {
    expect(() => computePassFlow({ passes: [], xEdges: [-5, 50, 100] })).toThrow(
      InvalidEdgesError,
    );
  });
});

// ---------------------------------------------------------------------------
// Value modes
// ---------------------------------------------------------------------------

describe("computePassFlow — value modes", () => {
  const clusterAt = (x: number, y: number, n: number) =>
    Array.from({ length: n }, () => makePass({ x, y, endX: x + 5, endY: y }));

  const passes = [
    ...clusterAt(55, 25, 6), // hot bin
    ...clusterAt(75, 25, 2),
    ...clusterAt(15, 75, 1),
  ];

  it("count mode emits raw counts and legend domain [0, maxCount]", () => {
    const model = computePassFlow({ passes, valueMode: "count", minCountForArrow: 1 });
    const hot = model.grid.bins.find((b) => b.count === 6)!;
    expect(hot.value).toBe(6);
    expect(model.legend?.domain).toEqual([0, 6]);
  });

  it("share mode emits count/totalValid", () => {
    const model = computePassFlow({ passes, valueMode: "share", minCountForArrow: 1 });
    const hot = model.grid.bins.find((b) => b.count === 6)!;
    expect(hot.share).toBeCloseTo(6 / 9, 6);
    expect(hot.value).toBeCloseTo(6 / 9, 6);
  });

  it("relative-frequency mode is honest for uniform bins", () => {
    // With 6×4 = 24 bins of equal area, expectedShare = 1/24 per bin.
    // A bin with 6 of 9 passes has observedShare = 6/9.
    // relativeFrequency = (6/9) / (1/24) = 16.
    const model = computePassFlow({
      passes,
      valueMode: "relative-frequency",
      minCountForArrow: 1,
    });
    const hot = model.grid.bins.find((b) => b.count === 6)!;
    expect(hot.relativeFrequency).toBeCloseTo(6 / 9 / (1 / 24), 5);
    expect(hot.value).toBeCloseTo(6 / 9 / (1 / 24), 5);
    // Legend domain anchored to ≥ 2 so midpoint=1 is centred.
    expect(model.legend?.domain[1]).toBeGreaterThanOrEqual(2);
  });

  it("relative-frequency honours non-uniform xEdges", () => {
    // 2 bins with widths 20 and 80; area shares 0.2 and 0.8.
    // Put all passes in the wide bin → observedShare = 1, expectedShare = 0.8 → RF = 1.25.
    const skewedPasses = [makePass({ x: 60, y: 50 }), makePass({ x: 70, y: 50 })];
    const model = computePassFlow({
      passes: skewedPasses,
      valueMode: "relative-frequency",
      xEdges: [0, 20, 100],
      yEdges: [0, 100],
      minCountForArrow: 1,
    });
    const big = model.grid.bins.find((b) => b.count > 0)!;
    expect(big.relativeFrequency).toBeCloseTo(1.25, 6);
  });
});

// ---------------------------------------------------------------------------
// Magnitude hint
// ---------------------------------------------------------------------------

describe("computePassFlow — magnitudeHint", () => {
  const seed: ComputePassFlowInput["passes"] = [
    ...Array.from({ length: 6 }, () => makePass({ x: 55, y: 25, endX: 80, endY: 25 })),
    ...Array.from({ length: 2 }, () => makePass({ x: 75, y: 75, endX: 95, endY: 75 })),
  ];

  it("'equal' → 1 for every arrow bin", () => {
    const model = computePassFlow({ passes: seed, arrowLengthMode: "equal" });
    const hits = model.grid.bins.filter((b) => b.hasArrow);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((b) => b.magnitudeHint === 1)).toBe(true);
  });

  it("'scaled-by-count' → count / maxCount", () => {
    const model = computePassFlow({ passes: seed, arrowLengthMode: "scaled-by-count" });
    const hot = model.grid.bins.find((b) => b.count === 6)!;
    const warm = model.grid.bins.find((b) => b.count === 2)!;
    expect(hot.magnitudeHint).toBeCloseTo(1, 10);
    expect(warm.magnitudeHint).toBeCloseTo(2 / 6, 10);
  });

  it("'scaled-by-resultant' → R", () => {
    const model = computePassFlow({
      passes: seed,
      arrowLengthMode: "scaled-by-resultant",
    });
    const hot = model.grid.bins.find((b) => b.count === 6)!;
    expect(hot.magnitudeHint).toBeCloseTo(hot.resultantLength, 10);
  });

  it("magnitudeHint=0 when the bin has no arrow", () => {
    const model = computePassFlow({ passes: seed, dispersionFloor: 2 }); // impossible floor
    expect(model.grid.bins.every((b) => b.magnitudeHint === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Meta, legend, header stats
// ---------------------------------------------------------------------------

describe("computePassFlow — meta surface", () => {
  it("exposes resolved config on meta", () => {
    const model = computePassFlow({
      passes: [makePass()],
      arrowLengthMode: "scaled-by-count",
      dispersionFloor: 0.25,
      minCountForArrow: 3,
      lowDispersionGlyph: "cross",
    });
    expect(model.meta.arrowLengthMode).toBe("scaled-by-count");
    expect(model.meta.dispersionFloor).toBe(0.25);
    expect(model.meta.minCountForArrow).toBe(3);
    expect(model.meta.lowDispersionGlyph).toBe("cross");
  });

  it("legend title defaults per valueMode", () => {
    expect(
      computePassFlow({ passes: [makePass()], valueMode: "count" }).legend?.title,
    ).toBe("Pass Count");
    expect(
      computePassFlow({ passes: [makePass()], valueMode: "share" }).legend?.title,
    ).toBe("Pass Origin Share");
    expect(
      computePassFlow({ passes: [makePass()], valueMode: "relative-frequency" }).legend
        ?.title,
    ).toBe("Pass Origin Relative Frequency");
  });

  it("metricLabel overrides the default", () => {
    const model = computePassFlow({
      passes: [makePass()],
      metricLabel: "Custom label",
    });
    expect(model.legend?.title).toBe("Custom label");
  });

  it("headerStats reports total, completion rate, and mean length", () => {
    const passes = [
      makePass({ passResult: "complete", length: 10 }),
      makePass({ passResult: "incomplete", length: 20 }),
      makePass({ passResult: "complete", length: 30 }),
    ];
    const model = computePassFlow({ passes });
    const items = model.headerStats!.items;
    expect(items[0]).toEqual({ label: "Passes", value: "3" });
    expect(items[1]!.value).toBe("67%");
    expect(items[2]!.value).toBe("20.0");
  });
});

// ---------------------------------------------------------------------------
// Accessible label
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Coverage gaps flagged in checkpoint-1 adversarial review
// ---------------------------------------------------------------------------

describe("computePassFlow — header stats describe the filtered population", () => {
  it("'Passes' equals totalValid (post-filter), not totalInput", () => {
    const passes = [
      makePass({ minute: 5 }),
      makePass({ minute: 30 }),
      makePass({ minute: 60 }),
    ];
    const model = computePassFlow({ passes, minMinute: 10, maxMinute: 45 });
    expect(model.headerStats!.items[0]!.value).toBe("1");
    expect(model.meta.stats.totalValid).toBe(1);
  });

  it("'Completion' uses coded-outcomes denominator — null passResult is not counted as a failure", () => {
    const passes = [
      makePass({ passResult: "complete" }),
      makePass({ passResult: "complete" }),
      makePass({ passResult: null }),
      makePass({ passResult: null }),
    ];
    const model = computePassFlow({ passes });
    // 2 complete / 2 coded = 100%, not 2/4 = 50%.
    expect(model.headerStats!.items[1]!.value).toBe("100%");
  });

  it("'Completion' reports '—' when no outcomes are coded", () => {
    const passes = [makePass({ passResult: null }), makePass({ passResult: null })];
    const model = computePassFlow({ passes });
    expect(model.headerStats!.items[1]!.value).toBe("—");
  });

  it("header stats describe one population across all three fields", () => {
    // Mix of dropped/kept passes; the three stats should all describe the 2
    // passes that survive the filters.
    const passes = [
      makePass({ minute: 5, passResult: "complete", length: 100 }), // dropped by minute
      makePass({ minute: 30, passResult: "complete", length: 10 }),
      makePass({ minute: 40, passResult: "incomplete", length: 20 }),
    ];
    const model = computePassFlow({ passes, minMinute: 10 });
    expect(model.headerStats!.items[0]!.value).toBe("2");
    expect(model.headerStats!.items[1]!.value).toBe("50%");
    expect(model.headerStats!.items[2]!.value).toBe("15.0"); // (10 + 20) / 2
  });
});

describe("computePassFlow — warnings mirror stats counters", () => {
  it("emits a warning for droppedByFilter", () => {
    const passes = [makePass({ minute: 5 }), makePass({ minute: 30 })];
    const model = computePassFlow({ passes, minMinute: 10 });
    expect(model.meta.stats.droppedByFilter).toBe(1);
    expect(model.meta.warnings.some((w) => /dropped by an active filter/.test(w))).toBe(
      true,
    );
  });

  it("emits a warning for droppedOutOfCrop", () => {
    const passes = [makePass({ x: 25, y: 50 }), makePass({ x: 75, y: 50 })];
    const model = computePassFlow({ passes, crop: "half" });
    expect(model.meta.stats.droppedOutOfCrop).toBe(1);
    expect(model.meta.warnings.some((w) => /outside the active crop/.test(w))).toBe(true);
  });
});

describe("computePassFlow — relative-frequency intensity alignment", () => {
  it("uniform team under RF + diverging ramp paints every bin as the neutral midpoint", () => {
    // Synthesize a uniform distribution: one pass at the centre of every bin.
    const binsX = 6;
    const binsY = 4;
    const uniformPasses: PassEvent[] = [];
    for (let c = 0; c < binsX; c += 1) {
      for (let r = 0; r < binsY; r += 1) {
        const x = (c + 0.5) * (100 / binsX);
        const y = (r + 0.5) * (100 / binsY);
        uniformPasses.push(makePass({ x, y }));
      }
    }
    const model = computePassFlow({
      passes: uniformPasses,
      valueMode: "relative-frequency",
      minCountForArrow: 1,
    });
    // Every bin has RF ≈ 1 (observed share = expected share).
    for (const bin of model.grid.bins) {
      expect(bin.relativeFrequency).toBeCloseTo(1, 6);
    }
    // With legend domain [0, 2], intensity = 1/2 = 0.5 — the colour-ramp
    // midpoint. A diverging ramp paints this as neutral, not saturated.
    expect(model.legend!.domain).toEqual([0, 2]);
    for (const bin of model.grid.bins) {
      expect(bin.intensity).toBeCloseTo(0.5, 6);
    }
  });
});

describe("computePassFlow — tooltip is agent-readable", () => {
  it("zone row includes the bin's x-extent in data space", () => {
    const model = computePassFlow({
      passes: [makePass({ x: 55, y: 25 })],
      minCountForArrow: 1,
    });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    const zoneRow = hit.tooltip.rows.find((r) => r.key === "zone")!;
    // Default 6 bins across x → bin width ~16.67; col=3 → x range ~50–67.
    expect(zoneRow.value).toContain("x ");
    expect(zoneRow.value).toContain("–");
  });
});

// ---------------------------------------------------------------------------
// Fixture-validation gate (packet step 10)
//
// Ensures the zero-config default (share + sequential-blues) produces a
// publishable chart on representative StatsBomb-style fixtures. If either
// threshold fails on a realistic match-sized input, the packet calls for
// flipping the default to `relative-frequency` + `diverging-rdbu`.
// ---------------------------------------------------------------------------

describe("computePassFlow — default-saturation gate", () => {
  function synthMatch(opts: {
    count: number;
    seed: number;
    bias?: "left" | "centre" | "spread";
  }): PassEvent[] {
    // Deterministic PRNG so this test stays stable.
    let s = opts.seed;
    const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
    const out: PassEvent[] = [];
    for (let i = 0; i < opts.count; i += 1) {
      let x: number;
      if (opts.bias === "left")
        x = rand() * 60; // low-possession team pinned back
      else if (opts.bias === "centre")
        x = 35 + rand() * 30; // tight around halfway
      else x = rand() * 100; // open game
      const y = rand() * 100;
      out.push(
        makePass({
          x,
          y,
          endX: Math.min(100, x + (rand() - 0.3) * 30),
          endY: y + (rand() - 0.5) * 30,
        }),
      );
    }
    return out;
  }

  const fixtures = [
    {
      label: "high-possession open game (400 passes)",
      passes: synthMatch({ count: 400, seed: 1, bias: "spread" }),
    },
    {
      label: "mid-possession (300 passes)",
      passes: synthMatch({ count: 300, seed: 2, bias: "centre" }),
    },
    {
      label: "low-possession pinned back (220 passes)",
      passes: synthMatch({ count: 220, seed: 3, bias: "left" }),
    },
  ];

  it("default (share + sequential-blues) is not under-saturated on realistic fixtures", () => {
    const undersaturated: string[] = [];
    for (const { label, passes } of fixtures) {
      const model = computePassFlow({ passes });
      const filled = model.grid.bins.filter((b) => b.count > 0);
      expect(filled.length).toBeGreaterThan(0);
      const sorted = filled.map((b) => b.intensity).sort((a, b) => a - b);
      const max = sorted[sorted.length - 1]!;
      const median = sorted[Math.floor(sorted.length / 2)]!;
      // Packet rule: flip default when `max < 0.4` OR `median < 0.08` on ≥2 of 3.
      if (max < 0.4 || median < 0.08) undersaturated.push(label);
    }
    // Gate assertion: fewer than 2 of 3 fixtures under-saturated.
    expect(undersaturated.length).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// Model-shape regression snapshot
//
// Locks the compute-layer contract against a deterministic input. Any change
// to `PassFlowBinModel` shape, gating math, or tooltip rows needs an explicit
// fixture regenerate — not a silent drift in renderer or downstream consumers.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// captureDestinations
// ---------------------------------------------------------------------------

describe("computePassFlow — captureDestinations", () => {
  const passes = [
    makePass({ x: 55, y: 25, endX: 80, endY: 30 }),
    makePass({ x: 55, y: 25, endX: 85, endY: 40 }),
    makePass({ x: 55, y: 25, endX: 70, endY: 20 }),
  ];

  it("default keeps destinations empty — shared singleton", () => {
    const model = computePassFlow({ passes });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.destinations).toEqual([]);
    expect(hit.destinations.length).toBe(0);
    // Confirm the singleton pattern: two empty arrays should be the same ref.
    const another = model.grid.bins.find((b) => b.count === 0)!;
    expect(another.destinations).toBe(hit.destinations);
  });

  it("captureDestinations=true populates destinations with raw end-xy", () => {
    const model = computePassFlow({ passes, captureDestinations: true });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.destinations.length).toBe(3);
    expect(hit.destinations[0]).toEqual({ endX: 80, endY: 30 });
    expect(hit.destinations[2]).toEqual({ endX: 70, endY: 20 });
  });

  it("destinations respect directionFilter (only matched-direction passes)", () => {
    const mixed = [
      makePass({ x: 55, y: 25, endX: 80, endY: 25 }), // forward
      makePass({ x: 55, y: 25, endX: 30, endY: 25 }), // backward
    ];
    const model = computePassFlow({
      passes: mixed,
      captureDestinations: true,
      directionFilter: "forward",
    });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.destinations).toEqual([{ endX: 80, endY: 25 }]);
  });
});

// ---------------------------------------------------------------------------
// Period filter
// ---------------------------------------------------------------------------

describe("computePassFlow — periodFilter", () => {
  const passes = [
    makePass({ x: 55, y: 25, period: 1 }),
    makePass({ x: 55, y: 25, period: 1 }),
    makePass({ x: 75, y: 75, period: 2 }),
    makePass({ x: 75, y: 75, period: 2 }),
    makePass({ x: 55, y: 75, period: 2 }),
  ];

  it("default keeps every period", () => {
    const model = computePassFlow({ passes });
    expect(model.meta.stats.totalValid).toBe(5);
  });

  it("periodFilter=[1] keeps only first-half passes", () => {
    const model = computePassFlow({ passes, periodFilter: [1] });
    expect(model.meta.stats.totalValid).toBe(2);
    expect(model.meta.stats.droppedByFilter).toBe(3);
  });

  it("periodFilter=[] excludes every pass", () => {
    const model = computePassFlow({ passes, periodFilter: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.meta.stats.droppedByFilter).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Direction filter
// ---------------------------------------------------------------------------

describe("computePassFlow — directionFilter", () => {
  function clusterAt(x: number, y: number, endX: number, endY: number, n: number) {
    return Array.from({ length: n }, () => makePass({ x, y, endX, endY }));
  }

  // Three clusters at (55,25): 4 forward, 2 backward, 3 lateral.
  const mixed = [
    ...clusterAt(55, 25, 80, 25, 4), // forward
    ...clusterAt(55, 25, 30, 25, 2), // backward
    ...clusterAt(55, 25, 55, 70, 3), // lateral (+y)
  ];

  it("default 'all' keeps every direction in count and mean", () => {
    const model = computePassFlow({ passes: mixed });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.count).toBe(9);
    expect(hit.directionCount).toBe(9);
  });

  it("'forward' keeps only forward passes and the mean points at +x", () => {
    const model = computePassFlow({ passes: mixed, directionFilter: "forward" });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.count).toBe(4);
    expect(hit.directionCount).toBe(4);
    expect(hit.meanAngle).toBeCloseTo(0, 10);
    expect(model.meta.stats.droppedByFilter).toBe(5);
  });

  it("'backward' keeps only backward passes and the mean points at ±π", () => {
    const model = computePassFlow({ passes: mixed, directionFilter: "backward" });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.count).toBe(2);
    expect(Math.abs(Math.abs(hit.meanAngle!) - Math.PI)).toBeLessThan(1e-9);
  });

  it("'lateral' keeps only sideways passes", () => {
    const model = computePassFlow({ passes: mixed, directionFilter: "lateral" });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.count).toBe(3);
    expect(hit.meanAngle).toBeCloseTo(Math.PI / 2, 10);
  });
});

// ---------------------------------------------------------------------------
// scaled-by-distance
// ---------------------------------------------------------------------------

describe("computePassFlow — arrowLengthMode='scaled-by-distance'", () => {
  it("magnitudeHint is meanDistance / maxMeanDistance across bins", () => {
    // Short-pass cluster (5m) and long-pass cluster (25m), each n=3.
    const passes = [
      ...Array.from({ length: 3 }, () => makePass({ x: 25, y: 25, endX: 30, endY: 25 })),
      ...Array.from({ length: 3 }, () => makePass({ x: 75, y: 75, endX: 100, endY: 75 })),
    ];
    const model = computePassFlow({ passes, arrowLengthMode: "scaled-by-distance" });
    const short = model.grid.bins.find((b) => b.count === 3 && b.x < 50)!;
    const long = model.grid.bins.find((b) => b.count === 3 && b.x >= 50)!;
    expect(short.meanDistance).toBeCloseTo(5, 10);
    expect(long.meanDistance).toBeCloseTo(25, 10);
    expect(long.magnitudeHint).toBeCloseTo(1, 10); // the longest
    expect(short.magnitudeHint).toBeCloseTo(5 / 25, 10);
  });

  it("meanDistance is always emitted on the bin model, regardless of arrow mode", () => {
    const passes = Array.from({ length: 3 }, () =>
      makePass({ x: 25, y: 25, endX: 40, endY: 25 }),
    );
    const model = computePassFlow({ passes });
    const hit = model.grid.bins.find((b) => b.count > 0)!;
    expect(hit.meanDistance).toBeCloseTo(15, 10);
  });
});

describe("computePassFlow — baseline regression snapshot", () => {
  it("matches the stored fixture", () => {
    function p(
      id: number,
      x: number,
      y: number,
      endX: number,
      endY: number,
      passResult: PassEvent["passResult"] = "complete",
    ): PassEvent {
      return {
        kind: "pass",
        id: `p${id}`,
        matchId: "m",
        teamId: "t",
        playerId: null,
        playerName: null,
        minute: 10,
        addedMinute: null,
        second: 0,
        period: 1,
        x,
        y,
        endX,
        endY,
        length: Math.hypot(endX - x, endY - y),
        angle: Math.atan2(endY - y, endX - x),
        recipient: null,
        passType: "ground",
        passResult,
        isAssist: false,
        provider: "statsbomb",
        providerEventId: `p${id}`,
      } as PassEvent;
    }
    const passes = [
      p(1, 55, 25, 80, 25),
      p(2, 55, 25, 80, 25),
      p(3, 55, 25, 80, 25),
      p(4, 75, 75, 95, 75),
      p(5, 75, 75, 95, 75),
      p(6, 25, 25, 45, 25, "incomplete"),
    ];
    const model = computePassFlow({ passes });
    const expected = JSON.parse(fs.readFileSync(BASELINE_FIXTURE_PATH, "utf8"));
    expect(JSON.parse(JSON.stringify(model))).toEqual(expected);
  });
});

describe("computePassFlow — a11y", () => {
  it("accessibleLabel describes the grid shape and valid count", () => {
    const model = computePassFlow({
      passes: [makePass({ x: 55, y: 25 })],
      bins: { x: 8, y: 5 },
    });
    expect(model.meta.accessibleLabel).toBe("Pass flow: 1 passes across 8×5 zones");
  });

  it("accessibleLabel handles empty input", () => {
    const model = computePassFlow({ passes: [] });
    expect(model.meta.accessibleLabel).toBe("Pass flow: no passes");
  });
});
