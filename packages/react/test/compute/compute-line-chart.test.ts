import { describe, expect, it } from "vitest";

import { computeLineChart, type LineChartSeriesInput } from "../../src/compute/index";

function makeSeries(id: string, ys: number[]): LineChartSeriesInput {
  return {
    id,
    label: id,
    points: ys.map((y, i) => ({ x: i + 1, y })),
  };
}

describe("computeLineChart", () => {
  it("returns emptyState when series array is empty", () => {
    const model = computeLineChart({ series: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.series).toHaveLength(0);
    expect(model.endLabels).toHaveLength(0);
    expect(model.emptyState).toEqual({ message: "No data" });
  });

  it("returns emptyState when every series is invalid", () => {
    const model = computeLineChart({
      series: [{ id: "a", points: [{ x: NaN, y: 1 }] }],
    });
    expect(model.meta.empty).toBe(true);
    expect(model.meta.warnings.some((w) => w.includes("dropped"))).toBe(true);
  });

  it("sorts points by x and drops non-finite values with a warning", () => {
    const model = computeLineChart({
      series: [
        {
          id: "a",
          points: [
            { x: 3, y: 3 },
            { x: 1, y: 1 },
            { x: 2, y: Number.POSITIVE_INFINITY },
            { x: 4, y: 4 },
          ],
        },
      ],
    });
    const series = model.series[0];
    expect(series?.points.map((p) => p.x)).toEqual([1, 3, 4]);
    expect(model.meta.droppedPoints).toBe(1);
    expect(model.meta.warnings.some((w) => w.includes("dropped"))).toBe(true);
  });

  it("produces a line path, summary stats, and end label", () => {
    const model = computeLineChart({
      series: [makeSeries("x", [10, 20, 30])],
    });
    const series = model.series[0];
    expect(series?.path).toMatch(/^M \d/);
    expect(series?.summary.count).toBe(3);
    expect(series?.summary.minY).toBe(10);
    expect(series?.summary.maxY).toBe(30);
    expect(series?.summary.meanY).toBe(20);
    expect(model.endLabels).toHaveLength(1);
    expect(model.endLabels[0]?.id).toBe("x");
  });

  it("computes a linear-regression trendline when enabled", () => {
    // y = 2x perfectly — slope should be 2, intercept ~0
    const model = computeLineChart({
      series: [{ id: "lin", points: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x })) }],
      trendlines: true,
    });
    const tl = model.series[0]?.trendline;
    expect(tl).not.toBeNull();
    expect(tl?.slope).toBeCloseTo(2, 6);
    expect(tl?.intercept).toBeCloseTo(0, 6);
    expect(tl?.path).toMatch(/^M \d/);
  });

  it("passes per-series strokeDasharray and showMarkers through to the model", () => {
    const model = computeLineChart({
      series: [
        makeSeries("actual", [1, 2, 3]),
        {
          id: "pace",
          label: "Pace",
          points: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
          ],
          strokeDasharray: "6 4",
          showMarkers: false,
        },
      ],
    });
    const actual = model.series.find((s) => s.id === "actual");
    const pace = model.series.find((s) => s.id === "pace");
    expect(actual?.strokeDasharray).toBeNull();
    expect(actual?.showMarkers).toBe(true);
    expect(pace?.strokeDasharray).toBe("6 4");
    expect(pace?.showMarkers).toBe(false);
  });

  it("respects per-series trendline override (opt out)", () => {
    const model = computeLineChart({
      series: [
        { id: "a", points: [1, 2, 3].map((x) => ({ x, y: x })) },
        { id: "b", points: [1, 2, 3].map((x) => ({ x, y: x })), trendline: false },
      ],
      trendlines: true,
    });
    expect(model.series.find((s) => s.id === "a")?.trendline).not.toBeNull();
    expect(model.series.find((s) => s.id === "b")?.trendline).toBeNull();
  });

  it("skips trendline for series with fewer than 2 points", () => {
    const model = computeLineChart({
      series: [{ id: "a", points: [{ x: 1, y: 1 }] }],
      trendlines: true,
    });
    expect(model.series[0]?.trendline).toBeNull();
  });

  it("honours highlightSeries — non-highlighted render as background", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 3]), makeSeries("b", [4, 5, 6])],
      highlightSeries: ["a"],
    });
    const a = model.series.find((s) => s.id === "a");
    const b = model.series.find((s) => s.id === "b");
    expect(a?.highlighted).toBe(true);
    expect(b?.highlighted).toBe(false);
    // Only highlighted series gets an end label by default
    expect(model.endLabels.map((l) => l.id)).toEqual(["a"]);
  });

  it("emits end labels for every series when endLabelsForAllSeries is set", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 3]), makeSeries("b", [4, 5, 6])],
      highlightSeries: ["a"],
      endLabelsForAllSeries: true,
    });
    expect(model.endLabels.map((l) => l.id).sort()).toEqual(["a", "b"]);
  });

  it("pushes overlapping end labels apart", () => {
    // Two series with identical last-y → raw positions collide
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 5]), makeSeries("b", [1, 2, 5])],
      endLabelsForAllSeries: true,
    });
    const ys = model.endLabels.map((l) => l.y);
    expect(ys[0]).not.toBe(ys[1]);
    expect(Math.abs((ys[1] ?? 0) - (ys[0] ?? 0))).toBeGreaterThanOrEqual(12);
  });

  it("exposes a mirrored y2 axis when dualYAxis is true", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 3])],
      dualYAxis: true,
    });
    expect(model.axes.y2).not.toBeNull();
    expect(model.axes.y2?.ticks).toEqual(model.axes.y.ticks);
  });

  it("carries declared references through into model.references", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 3])],
      references: [{ kind: "vertical", x: 2, label: "mid", id: "mid" }],
    });
    expect(model.references).toHaveLength(1);
    const ref = model.references[0];
    if (ref?.kind !== "vertical") throw new Error("expected vertical");
    expect(ref.x).toBe(2);
    expect(ref.label).toBe("mid");
  });

  it("carries declared bands through into model.bands", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 2, 3])],
      bands: [{ axis: "y", range: [1, 2], label: "low", id: "low" }],
    });
    expect(model.bands).toHaveLength(1);
    expect(model.bands[0]?.label).toBe("low");
  });

  describe("band / reference / envelope validation surfaces warnings", () => {
    it("emits [band.out-of-domain] for a band outside the y domain", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        bands: [{ axis: "y", range: [1000, 2000], label: "nope" }],
      });
      expect(model.meta.warnings.some((w) => w.includes("[band.out-of-domain]"))).toBe(
        true,
      );
      // Dropped band is NOT in model.bands (pre-validation input had 1, resolved 0).
      expect(model.bands).toHaveLength(0);
    });

    it("emits [band.zero-width] for a zero-width band", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        bands: [{ axis: "y", range: [2, 2] }],
      });
      expect(model.meta.warnings.some((w) => w.includes("[band.zero-width]"))).toBe(true);
    });

    it("emits [reference.out-of-domain] for a horizontal reference outside y domain", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        references: [{ kind: "horizontal", y: 1000 }],
      });
      expect(
        model.meta.warnings.some((w) => w.includes("[reference.out-of-domain]")),
      ).toBe(true);
      expect(model.references).toHaveLength(0);
    });

    it("emits [reference.degenerate] for a diagonal from===to", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        references: [{ kind: "diagonal", from: [1, 1], to: [1, 1] }],
      });
      expect(model.meta.warnings.some((w) => w.includes("[reference.degenerate]"))).toBe(
        true,
      );
    });

    it("emits [reference.duplicate-id] when two references share an id", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        references: [
          { kind: "horizontal", y: 1.5, id: "dup" },
          { kind: "horizontal", y: 2.5, id: "dup" },
        ],
      });
      expect(
        model.meta.warnings.some((w) => w.includes("[reference.duplicate-id]")),
      ).toBe(true);
    });

    it("emits [envelope.truncated] when a source series had points dropped", () => {
      const model = computeLineChart({
        series: [
          {
            id: "a",
            points: [
              { x: 1, y: 1 },
              { x: 2, y: NaN },
              { x: 3, y: 3 },
            ],
          },
          {
            id: "b",
            points: [
              { x: 1, y: 0 },
              { x: 2, y: 0 },
              { x: 3, y: 0 },
            ],
          },
        ],
        envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b", id: "env" }],
      });
      expect(model.meta.warnings.some((w) => w.includes("[envelope.truncated]"))).toBe(
        true,
      );
    });

    it("accessibleLabel counts only resolved bands (dropped ones excluded)", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        bands: [
          { axis: "y", range: [1000, 2000], label: "dropped" },
          { axis: "y", range: [1.5, 2.5], label: "kept" },
        ],
      });
      expect(model.meta.accessibleLabel).toContain("1 band");
      expect(model.meta.accessibleLabel).toContain("kept");
      expect(model.meta.accessibleLabel).not.toContain("dropped");
    });
  });

  it("resolves envelopes and pushes any warnings into meta.warnings", () => {
    const model = computeLineChart({
      series: [
        {
          id: "a",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          id: "b",
          points: [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
          ],
        },
      ],
      envelopes: [{ kind: "series-pair", seriesAId: "a", seriesBId: "b", id: "env" }],
    });
    expect(model.envelopes).toHaveLength(1);
    expect(model.envelopes[0]?.id).toBe("env");
  });

  it("supports explicit tick arrays and custom formatters", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [0.5, 1, 1.5])],
      yTicks: [0.5, 1, 1.5],
      yTickFormat: (v) => `${v.toFixed(1)}g`,
    });
    expect(model.axes.y.ticks).toEqual([0.5, 1, 1.5]);
    expect(model.axes.y.tickLabels).toEqual(["0.5g", "1.0g", "1.5g"]);
  });

  it("warns when yScale is 'log' and falls back to linear", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1, 10, 100])],
      yScale: "log",
    });
    expect(model.meta.warnings.some((w) => w.includes("log"))).toBe(true);
  });

  it("truncates highlightSeries beyond the cap with a warning", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [1]), makeSeries("b", [2]), makeSeries("c", [3])],
      highlightSeries: ["a", "b", "c"],
      maxHighlight: 2,
    });
    expect(model.meta.highlightedSeries).toBe(2);
    expect(model.meta.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("warns when yDomain clamps real data points out of range", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [0.1, 1.0, 2.5, 0.2])],
      yDomain: [0.5, 2.0],
    });
    expect(model.meta.warnings.some((w) => w.includes("clips 3 point"))).toBe(true);
  });

  it("does not warn when yDomain fully contains the data", () => {
    const model = computeLineChart({
      series: [makeSeries("a", [0.5, 1.0, 1.5])],
      yDomain: [0, 2],
    });
    expect(model.meta.warnings.some((w) => w.includes("clips"))).toBe(false);
  });

  it("extends trendlines across the full x axis domain", () => {
    // Data at x=1..5. nice-ticks typically widens x domain below 1 / above 5.
    const model = computeLineChart({
      series: [{ id: "a", points: [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x })) }],
      trendlines: true,
    });
    const tl = model.series[0]?.trendline;
    expect(tl).not.toBeNull();
    // Path has two points: M <x0> <y0> L <x1> <y1>
    const match = tl?.path.match(
      /^M (-?\d+\.?\d*) (-?\d+\.?\d*) L (-?\d+\.?\d*) (-?\d+\.?\d*)$/,
    );
    expect(match).not.toBeNull();
    const x0 = parseFloat(match![1]!);
    const x1 = parseFloat(match![3]!);
    const { plotArea } = model.layout;
    // The trendline should start at the plot-area left edge and end at the
    // right edge (give or take rounding), not stop at the data points.
    expect(x0).toBeCloseTo(plotArea.x, 0);
    expect(x1).toBeCloseTo(plotArea.x + plotArea.width, 0);
  });

  it("empty-state tick labels are blank placeholders, not locale-formatted stubs", () => {
    const model = computeLineChart({ series: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.axes.x.tickLabels.every((s) => s === "")).toBe(true);
    expect(model.axes.y.tickLabels.every((s) => s === "")).toBe(true);
  });

  describe("axisPadding (gutter between scale range and frame)", () => {
    it("insets plotArea by default 6px on each side, keeps frame at outer bounds", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
      });
      const { plotArea, frame } = model.layout;
      expect(plotArea.x - frame.x).toBe(6);
      expect(plotArea.y - frame.y).toBe(6);
      expect(frame.width - plotArea.width).toBe(12);
      expect(frame.height - plotArea.height).toBe(12);
    });

    it("axisPadding: 0 (or false) makes plotArea === frame", () => {
      const zero = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        axisPadding: 0,
      });
      expect(zero.layout.plotArea).toEqual(zero.layout.frame);

      const falseCase = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        axisPadding: false,
      });
      expect(falseCase.layout.plotArea).toEqual(falseCase.layout.frame);
    });

    it("supports per-axis [x, y] tuple", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        axisPadding: [3, 9],
      });
      const { plotArea, frame } = model.layout;
      expect(plotArea.x - frame.x).toBe(3);
      expect(plotArea.y - frame.y).toBe(9);
    });

    it("clamps negative values to 0", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        axisPadding: [-5, -5],
      });
      expect(model.layout.plotArea).toEqual(model.layout.frame);
    });

    it("first and last markers sit inside the frame by axisPadding", () => {
      const model = computeLineChart({
        series: [makeSeries("a", [1, 2, 3])],
        axisPadding: 6,
      });
      const first = model.series[0]?.points[0];
      const last = model.series[0]?.points[2];
      expect(first?.cx).toBeGreaterThanOrEqual(model.layout.frame.x + 6);
      expect(last?.cx).toBeLessThanOrEqual(
        model.layout.frame.x + model.layout.frame.width - 6,
      );
    });
  });

  describe("series[].hidden semantics", () => {
    it("counts hidden series in dataSeries but not visibleSeries", () => {
      const model = computeLineChart({
        series: [
          makeSeries("vis", [1, 2, 3]),
          { ...makeSeries("hid", [4, 5, 6]), hidden: true },
        ],
      });
      expect(model.meta.totalSeries).toBe(2);
      expect(model.meta.dataSeries).toBe(2);
      expect(model.meta.visibleSeries).toBe(1);
    });

    it("emits [hidden.extends-x-domain] when hidden series widens x domain", () => {
      const model = computeLineChart({
        series: [
          {
            id: "vis",
            points: [
              { x: 5, y: 1 },
              { x: 10, y: 2 },
            ],
          },
          {
            id: "hid",
            points: [
              { x: 0, y: 1 },
              { x: 100, y: 2 },
            ],
            hidden: true,
          },
        ],
      });
      expect(
        model.meta.warnings.some((w) => w.includes("[hidden.extends-x-domain]")),
      ).toBe(true);
    });

    it("emits [hidden.extends-y-domain] when hidden series widens y domain", () => {
      const model = computeLineChart({
        series: [
          {
            id: "vis",
            points: [
              { x: 1, y: 1 },
              { x: 2, y: 2 },
            ],
          },
          {
            id: "hid",
            points: [
              { x: 1, y: -10 },
              { x: 2, y: 100 },
            ],
            hidden: true,
          },
        ],
      });
      expect(
        model.meta.warnings.some((w) => w.includes("[hidden.extends-y-domain]")),
      ).toBe(true);
    });

    it("returns empty state when every series is hidden (no visible render surface)", () => {
      const model = computeLineChart({
        series: [
          { ...makeSeries("a", [1, 2, 3]), hidden: true },
          { ...makeSeries("b", [4, 5, 6]), hidden: true },
        ],
      });
      expect(model.meta.empty).toBe(true);
      expect(model.emptyState).not.toBeNull();
      expect(model.series).toHaveLength(0);
      expect(model.meta.visibleSeries).toBe(0);
    });

    it("tracks hidden in series model when at least one series is visible", () => {
      const model = computeLineChart({
        series: [
          makeSeries("vis", [1, 2, 3]),
          { ...makeSeries("hid", [4, 5, 6]), hidden: true },
        ],
      });
      const hiddenModel = model.series.find((s) => s.id === "hid");
      expect(hiddenModel?.hidden).toBe(true);
      expect(hiddenModel?.points).toHaveLength(0);
      expect(hiddenModel?.path).toBe("");
    });

    it("skips hidden series in palette allocation (visible-only enumeration)", () => {
      const model = computeLineChart({
        series: [
          makeSeries("a", [1, 2]), // palette[0]
          { ...makeSeries("b", [3, 4]), hidden: true }, // skipped
          makeSeries("c", [5, 6]), // palette[1], NOT palette[2]
        ],
      });
      // Assert exact palette colours (first two entries of DEFAULT_PALETTE).
      const a = model.series.find((s) => s.id === "a");
      const c = model.series.find((s) => s.id === "c");
      expect(a?.color).toBe("#c8102e");
      expect(c?.color).toBe("#6cabdd");
    });

    it("does not compute a trendline for hidden series even when trendline:true", () => {
      const model = computeLineChart({
        series: [
          makeSeries("vis", [1, 2, 3]),
          { ...makeSeries("h", [1, 2, 3]), hidden: true, trendline: true },
        ],
      });
      const h = model.series.find((s) => s.id === "h");
      expect(h?.trendline).toBeNull();
    });

    it("ignores hidden id in highlightSeries + emits [highlight.hidden-target]", () => {
      const model = computeLineChart({
        series: [
          makeSeries("a", [1, 2, 3]),
          { ...makeSeries("h", [4, 5, 6]), hidden: true },
        ],
        highlightSeries: ["h"],
      });
      expect(
        model.meta.warnings.some((w) => w.includes("[highlight.hidden-target]")),
      ).toBe(true);
    });

    it("excludes hidden series from end labels", () => {
      const model = computeLineChart({
        series: [
          makeSeries("a", [1, 2, 3]),
          { ...makeSeries("h", [4, 5, 6]), hidden: true },
        ],
        endLabelsForAllSeries: true,
      });
      expect(model.endLabels.map((l) => l.id)).toEqual(["a"]);
    });

    it("accessibleLabel uses visibleSeries count", () => {
      const model = computeLineChart({
        series: [
          makeSeries("a", [1, 2, 3]),
          { ...makeSeries("h", [4, 5, 6]), hidden: true },
        ],
      });
      expect(model.meta.accessibleLabel).toContain("1 series");
    });
  });
});
