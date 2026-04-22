import { describe, expect, it } from "vitest";

import {
  computeEnvelopes,
  type EnvelopeReferenceGeometry,
  type EnvelopeSourceSeries,
  type LineChartEnvelope,
} from "../../src/compute/envelope";

function linearSeries(
  id: string,
  points: readonly [number, number][],
): EnvelopeSourceSeries {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

describe("computeEnvelopes", () => {
  const defaultFill = "#cccccc";

  it("returns empty when input envelopes is empty", () => {
    const res = computeEnvelopes({
      envelopes: [],
      workingSeries: [],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(0);
  });

  it("series-pair: warns and drops on unknown series", () => {
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-pair", seriesAId: "missing", seriesBId: "b", id: "env1" },
      ],
      workingSeries: [
        linearSeries("b", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(0);
    expect(res.warnings[0]).toMatch(/\[envelope.unknown-series\]/);
  });

  it("series-pair: warns on disjoint x ranges", () => {
    const res = computeEnvelopes({
      envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b" }],
      workingSeries: [
        linearSeries("a", [
          [0, 0],
          [1, 1],
        ]),
        linearSeries("b", [
          [10, 5],
          [20, 6],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.warnings[0]).toMatch(/\[envelope.no-overlap\]/);
  });

  it("series-pair: single-colour renders one polygon (A→B)", () => {
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-pair", seriesAId: "a", seriesBId: "b", fill: "#ff0000" },
      ],
      workingSeries: [
        linearSeries("a", [
          [0, 10],
          [5, 10],
        ]),
        linearSeries("b", [
          [0, 5],
          [5, 5],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
    expect(res.models[0]?.paths).toHaveLength(1);
    expect(res.models[0]?.paths[0]?.fill).toBe("#ff0000");
    expect(res.models[0]?.hasCrossovers).toBe(false);
  });

  it("series-pair: sign alternates → crossovers + two-colour split", () => {
    const res = computeEnvelopes({
      envelopes: [
        {
          kind: "series-pair",
          seriesAId: "a",
          seriesBId: "b",
          fillPositive: "#00ff00",
          fillNegative: "#ff0000",
        },
      ],
      workingSeries: [
        linearSeries("a", [
          [0, 10],
          [5, 0],
        ]),
        linearSeries("b", [
          [0, 0],
          [5, 10],
        ]),
      ],
      references: [],
      defaultFill,
    });
    const env = res.models[0]!;
    expect(env.hasCrossovers).toBe(true);
    const fills = env.paths.map((p) => p.fill);
    expect(fills).toContain("#00ff00");
    expect(fills).toContain("#ff0000");
  });

  it("series-pair: sparse x on one side uses merged grid interpolation", () => {
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-pair", seriesAId: "dense", seriesBId: "sparse", fill: "#c8102e" },
      ],
      workingSeries: [
        linearSeries("dense", [
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
        ]),
        linearSeries("sparse", [
          [0, 10],
          [4, 14],
        ]),
      ],
      references: [],
      defaultFill,
    });
    const env = res.models[0]!;
    // Grid should include 0..4 all points
    const xs = env.paths[0]!.points.map((p) => p.x);
    expect(xs).toContain(0);
    expect(xs).toContain(1);
    expect(xs).toContain(4);
  });

  it("center-offset: length mismatch → drops + warns", () => {
    const res = computeEnvelopes({
      envelopes: [
        {
          kind: "center-offset",
          centerSeriesId: "c",
          bounds: [{ x: 0, upper: 1, lower: -1 }],
        },
      ],
      workingSeries: [
        linearSeries("c", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.warnings[0]).toMatch(/\[envelope.bounds-mismatch\]/);
  });

  it("center-offset: upper < lower at majority → warning (still renders)", () => {
    const env: LineChartEnvelope = {
      kind: "center-offset",
      centerSeriesId: "c",
      bounds: [
        { x: 0, upper: -1, lower: 1 },
        { x: 1, upper: -2, lower: 2 },
        { x: 2, upper: 0, lower: 0.1 }, // 3 of 3 inverted
      ],
    };
    const res = computeEnvelopes({
      envelopes: [env],
      workingSeries: [
        linearSeries("c", [
          [0, 0],
          [1, 0],
          [2, 0],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes("[envelope.inverted-bounds]"))).toBe(true);
  });

  it("series-to-reference: unknown reference → warn + drop", () => {
    const res = computeEnvelopes({
      envelopes: [{ kind: "series-to-reference", seriesId: "s", referenceId: "nope" }],
      workingSeries: [
        linearSeries("s", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.warnings[0]).toMatch(/\[envelope.unknown-reference\]/);
  });

  it("series-to-reference: vertical reference → warn + drop", () => {
    const refs: EnvelopeReferenceGeometry[] = [{ id: "v", kind: "vertical" }];
    const res = computeEnvelopes({
      envelopes: [{ kind: "series-to-reference", seriesId: "s", referenceId: "v" }],
      workingSeries: [
        linearSeries("s", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: refs,
      defaultFill,
    });
    expect(res.warnings[0]).toMatch(/\[envelope.vertical-reference\]/);
  });

  it("series-to-reference: horizontal reference produces constant-y envelope", () => {
    const refs: EnvelopeReferenceGeometry[] = [{ id: "zero", kind: "horizontal", y: 0 }];
    const res = computeEnvelopes({
      envelopes: [
        {
          kind: "series-to-reference",
          seriesId: "s",
          referenceId: "zero",
          fill: "#c8102e",
        },
      ],
      workingSeries: [
        linearSeries("s", [
          [0, 2],
          [1, 4],
        ]),
      ],
      references: refs,
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
  });

  it("series-to-reference: clamps series to diagonal reference's declared x-support", () => {
    const refs: EnvelopeReferenceGeometry[] = [
      { id: "short", kind: "diagonal", from: [0, 0], to: [0.5, 0.5] },
    ];
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-to-reference", seriesId: "s", referenceId: "short", id: "env" },
      ],
      workingSeries: [
        linearSeries("s", [
          [0, 0],
          [0.25, 0.1],
          [0.5, 0.25],
          [0.75, 0.6],
          [1, 1],
        ]),
      ],
      references: refs,
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
    const polyXs = res.models[0]!.paths[0]!.points.map((p) => p.x);
    // x values past 0.5 should be excluded — reference has no support there.
    expect(Math.max(...polyXs)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it("series-to-reference: drops envelope when series falls entirely outside diagonal support", () => {
    const refs: EnvelopeReferenceGeometry[] = [
      { id: "r", kind: "diagonal", from: [10, 0], to: [20, 10] },
    ];
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-to-reference", seriesId: "s", referenceId: "r", id: "env" },
      ],
      workingSeries: [
        linearSeries("s", [
          [0, 0],
          [5, 5],
        ]),
      ],
      references: refs,
      defaultFill,
    });
    expect(res.models).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes("[envelope.no-overlap]"))).toBe(true);
  });

  it("distinguishes unknown-series from insufficient-points", () => {
    // unknown series
    const r1 = computeEnvelopes({
      envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b" }],
      workingSeries: [
        linearSeries("a", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(r1.warnings[0]).toMatch(/\[envelope.unknown-series\]/);

    // insufficient points (series known, only 1 point)
    const r2 = computeEnvelopes({
      envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b" }],
      workingSeries: [
        linearSeries("a", [[0, 0]]),
        linearSeries("b", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(r2.warnings[0]).toMatch(/\[envelope.insufficient-points\]/);
  });

  it("series-to-reference: diagonal (Lorenz) produces linear y(x) envelope", () => {
    const refs: EnvelopeReferenceGeometry[] = [
      { id: "equality", kind: "diagonal", from: [0, 0], to: [1, 1] },
    ];
    const lorenzPoints: [number, number][] = [
      [0, 0],
      [0.25, 0.1],
      [0.5, 0.25],
      [0.75, 0.45],
      [1, 1],
    ];
    const res = computeEnvelopes({
      envelopes: [
        {
          kind: "series-to-reference",
          seriesId: "lorenz",
          referenceId: "equality",
          fill: "#c8102e",
          id: "gini",
        },
      ],
      workingSeries: [linearSeries("lorenz", lorenzPoints)],
      references: refs,
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
    expect(res.models[0]?.id).toBe("gini");
    // The envelope polygon should have >= 2*points vertices (out + back)
    expect(res.models[0]?.paths[0]?.points.length).toBeGreaterThanOrEqual(
      lorenzPoints.length * 2,
    );
  });

  it("series-pair: identical bounds produces zero-width path (no crossover)", () => {
    const res = computeEnvelopes({
      envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b", fill: "#ccc" }],
      workingSeries: [
        linearSeries("a", [
          [0, 1],
          [1, 2],
        ]),
        linearSeries("b", [
          [0, 1],
          [1, 2],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(1);
    expect(res.models[0]?.hasCrossovers).toBe(false);
  });

  it("honours show: false by skipping the envelope entirely", () => {
    const res = computeEnvelopes({
      envelopes: [
        {
          kind: "series-pair",
          seriesAId: "a",
          seriesBId: "b",
          show: false,
        },
      ],
      workingSeries: [
        linearSeries("a", [
          [0, 1],
          [1, 2],
        ]),
        linearSeries("b", [
          [0, 0],
          [1, 1],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models).toHaveLength(0);
  });

  it("clip defaults to true and respects explicit false", () => {
    const res = computeEnvelopes({
      envelopes: [
        { kind: "series-pair", seriesAId: "a", seriesBId: "b", id: "default" },
        {
          kind: "series-pair",
          seriesAId: "a",
          seriesBId: "b",
          id: "overflowed",
          clip: false,
        },
      ],
      workingSeries: [
        linearSeries("a", [
          [0, 1],
          [1, 2],
        ]),
        linearSeries("b", [
          [0, 0],
          [1, 0],
        ]),
      ],
      references: [],
      defaultFill,
    });
    expect(res.models.find((m) => m.id === "default")?.clip).toBe(true);
    expect(res.models.find((m) => m.id === "overflowed")?.clip).toBe(false);
  });
});
