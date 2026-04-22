import { describe, expect, it } from "vitest";

import { computeRadarChart, type RadarChartRow } from "../../src/compute/index";

function makeRows(
  data: Array<{
    metric: string;
    value: number;
    percentile?: number;
    min?: number;
    max?: number;
    lowerIsBetter?: boolean;
    category?: string;
  }>,
): RadarChartRow[] {
  return data.map((d) => ({ ...d }));
}

const STANDARD_ROWS = makeRows([
  { metric: "Goals", value: 0.68, percentile: 92, category: "Attacking" },
  { metric: "npxG", value: 0.54, percentile: 87, category: "Attacking" },
  { metric: "Shots", value: 3.4, percentile: 78, category: "Attacking" },
  { metric: "Passes", value: 22.1, percentile: 45, category: "Possession" },
  { metric: "Carries", value: 2.1, percentile: 71, category: "Possession" },
  { metric: "Tackles", value: 0.9, percentile: 24, category: "Defending" },
  { metric: "Pressures", value: 16.3, percentile: 62, category: "Defending" },
]);

describe("computeRadarChart", () => {
  // ---- empty / edge states ------------------------------------------------

  it("returns emptyState when rows array is empty", () => {
    const model = computeRadarChart({ rows: [] });
    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No profile data" });
    expect(model.polygons).toHaveLength(0);
    expect(model.axes).toHaveLength(0);
  });

  it("excludes rows with missing metric name", () => {
    const model = computeRadarChart({
      rows: [
        { metric: "", value: 50, percentile: 50 },
        { metric: "Goals", value: 0.68, percentile: 92 },
      ],
    });
    expect(model.meta.validRows).toBe(1);
    expect(model.meta.warnings.some((w) => w.includes("excluded"))).toBe(true);
  });

  it("warns about single metric", () => {
    const model = computeRadarChart({
      rows: [{ metric: "Goals", value: 0.68, percentile: 92 }],
    });
    expect(model.meta.warnings.some((w) => w.includes("Single metric"))).toBe(true);
  });

  it("warns about sparse profile (<3 metrics)", () => {
    const model = computeRadarChart({
      rows: makeRows([
        { metric: "A", value: 50, percentile: 50 },
        { metric: "B", value: 60, percentile: 60 },
      ]),
    });
    expect(model.meta.warnings.some((w) => w.includes("not be informative"))).toBe(true);
  });

  it("warns when valueMode='percentile' but a row has no percentile field", () => {
    const model = computeRadarChart({
      rows: makeRows([
        { metric: "Goals", value: 0.68, percentile: 92 },
        { metric: "Shots", value: 3.4 },
        { metric: "Passes", value: 22.1 },
      ]),
    });
    const warning = model.meta.warnings.find((w) => w.includes('valueMode="percentile"'));
    expect(warning).toBeDefined();
    expect(warning).toContain("Shots");
    expect(warning).toContain("Passes");
  });

  it("does not warn about missing percentile in range mode", () => {
    const model = computeRadarChart({
      valueMode: "range",
      rows: makeRows([
        { metric: "A", value: 1, min: 0, max: 5 },
        { metric: "B", value: 2, min: 0, max: 5 },
        { metric: "C", value: 3, min: 0, max: 5 },
      ]),
    });
    expect(model.meta.warnings.some((w) => w.includes('valueMode="percentile"'))).toBe(
      false,
    );
  });

  // ---- polygon geometry ---------------------------------------------------

  it("creates a single polygon for standard rows", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.polygons).toHaveLength(1);
    expect(model.polygons[0]!.vertices).toHaveLength(7);
    expect(model.meta.empty).toBe(false);
  });

  it("polygon path is a closed SVG path", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    const path = model.polygons[0]!.path;
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/Z$/);
  });

  it("vertices have normalized values between 0 and 1", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    for (const v of model.polygons[0]!.vertices) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
  });

  // ---- percentile mode ----------------------------------------------------

  it("normalizes percentile to 0-1 in percentile mode", () => {
    const model = computeRadarChart({
      rows: [{ metric: "Goals", value: 0.68, percentile: 50 }],
    });
    expect(model.polygons[0]!.vertices[0]!.normalizedValue).toBeCloseTo(0.5);
  });

  it("clamps percentile to 0-100", () => {
    const model = computeRadarChart({
      rows: [
        { metric: "Over", value: 1, percentile: 150 },
        { metric: "Under", value: 0, percentile: -20 },
      ],
    });
    expect(model.polygons[0]!.vertices[0]!.normalizedValue).toBe(1);
    expect(model.polygons[0]!.vertices[1]!.normalizedValue).toBe(0);
  });

  // ---- range mode ---------------------------------------------------------

  it("normalizes using min/max in range mode", () => {
    const model = computeRadarChart({
      rows: [{ metric: "Goals", value: 5, min: 0, max: 10 }],
      valueMode: "range",
    });
    expect(model.polygons[0]!.vertices[0]!.normalizedValue).toBeCloseTo(0.5);
  });

  it("handles equal min/max gracefully", () => {
    const model = computeRadarChart({
      rows: [{ metric: "Goals", value: 5, min: 5, max: 5 }],
      valueMode: "range",
    });
    expect(model.polygons[0]!.vertices[0]!.normalizedValue).toBe(0.5);
  });

  // ---- lowerIsBetter ------------------------------------------------------

  it("inverts normalization when lowerIsBetter is true", () => {
    const model = computeRadarChart({
      rows: [{ metric: "Miscontrol", value: 1, percentile: 80, lowerIsBetter: true }],
    });
    // 80th percentile inverted = 0.2
    expect(model.polygons[0]!.vertices[0]!.normalizedValue).toBeCloseTo(0.2);
  });

  // ---- primary polygon color ---------------------------------------------

  it("uses the fixed zero-config primary polygon color", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.polygons[0]!.fillColor).toBe("#3b82f6");
    expect(model.polygons[0]!.strokeColor).toBe("#3b82f6");
  });

  // ---- category legend ----------------------------------------------------

  it("emits a category legend when 2+ categories are present", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
    });
    expect(model.legend).not.toBeNull();
    expect(model.legend!.items.map((i) => i.label)).toEqual([
      "Attacking",
      "Possession",
      "Defending",
    ]);
  });

  it("hides the category legend when only one category is present", () => {
    const model = computeRadarChart({
      rows: [
        { metric: "Goals", value: 1, percentile: 90, category: "Attacking" },
        { metric: "Shots", value: 3, percentile: 80, category: "Attacking" },
        { metric: "xG", value: 0.5, percentile: 85, category: "Attacking" },
      ],
    });
    expect(model.legend).toBeNull();
  });

  it("hides the category legend when showLegend is false", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      showLegend: false,
    });
    expect(model.legend).toBeNull();
  });

  it("honors an explicit categoryColors input in the legend and on axes", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
      categoryColors: ["#ff0000", "#00ff00", "#0000ff"],
    });

    expect(model.legend).not.toBeNull();
    const items = model.legend!.items;
    expect(items.find((i) => i.key === "Attacking")!.color).toBe("#ff0000");
    expect(items.find((i) => i.key === "Possession")!.color).toBe("#00ff00");
    expect(items.find((i) => i.key === "Defending")!.color).toBe("#0000ff");

    // Axis labels in the same categories carry the same color
    const attackingAxis = model.axes.find((a) => a.category === "Attacking")!;
    const defendingAxis = model.axes.find((a) => a.category === "Defending")!;
    expect(attackingAxis.color).toBe("#ff0000");
    expect(defendingAxis.color).toBe("#0000ff");
  });

  it("leaves axis.color null in single-category mode so renderers use theme defaults", () => {
    const model = computeRadarChart({
      rows: [
        { metric: "Goals", value: 1, percentile: 90, category: "Attacking" },
        { metric: "Shots", value: 3, percentile: 80, category: "Attacking" },
        { metric: "xG", value: 0.5, percentile: 85, category: "Attacking" },
      ],
    });
    for (const axis of model.axes) {
      expect(axis.color).toBeNull();
    }
  });

  // ---- axes and labels ----------------------------------------------------

  it("generates axes for each metric", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.axes).toHaveLength(7);
    expect(model.axes[0]!.metric).toBe("Goals");
  });

  it("hides axes when showAxisLabels is false", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      showAxisLabels: false,
    });
    expect(model.axes).toHaveLength(0);
  });

  // ---- rings and bands ----------------------------------------------------

  it("generates ring models at default steps", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.rings.length).toBeGreaterThan(0);
    expect(model.bands).toHaveLength(0); // default is "line" style
  });

  it("generates bands for banded ring style", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      ringStyle: "banded",
    });
    expect(model.bands.length).toBeGreaterThan(0);
  });

  it("ring labels show percentile values", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    const labels = model.rings.filter((r) => r.label != null).map((r) => r.label);
    expect(labels).toContain("50");
    expect(labels).toContain("75");
  });

  // ---- metric ordering ----------------------------------------------------

  it("respects explicit metricOrder", () => {
    const model = computeRadarChart({
      rows: STANDARD_ROWS,
      metricOrder: ["Pressures", "Goals", "Tackles"],
    });
    expect(model.polygons[0]!.vertices[0]!.metric).toBe("Pressures");
    expect(model.polygons[0]!.vertices[1]!.metric).toBe("Goals");
  });

  // ---- geometry -----------------------------------------------------------

  it("has consistent geometry constants", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.geometry.viewBoxSize).toBe(400);
    expect(model.geometry.center).toBe(200);
    expect(model.geometry.outerRadius).toBe(140);
  });

  // ---- accessible label ---------------------------------------------------

  it("generates accessible label", () => {
    const model = computeRadarChart({ rows: STANDARD_ROWS });
    expect(model.meta.accessibleLabel).toContain("7 metrics");
  });

  it("generates empty accessible label", () => {
    const model = computeRadarChart({ rows: [] });
    expect(model.meta.accessibleLabel).toContain("no profile data");
  });

  // ---- multi-profile comparison ------------------------------------------

  describe("multi-profile", () => {
    const A: RadarChartRow[] = [
      { metric: "Goals", value: 0.7, percentile: 90, category: "Attacking" },
      { metric: "Shots", value: 3, percentile: 70, category: "Attacking" },
      { metric: "Passes", value: 20, percentile: 40, category: "Possession" },
    ];
    const B: RadarChartRow[] = [
      { metric: "Goals", value: 0.3, percentile: 45, category: "Attacking" },
      { metric: "Shots", value: 4.5, percentile: 90, category: "Attacking" },
      { metric: "Passes", value: 28, percentile: 80, category: "Possession" },
    ];

    it("emits one polygon per series in input order", () => {
      const model = computeRadarChart({
        series: [
          { id: "a", label: "A", rows: A },
          { id: "b", label: "B", rows: B },
        ],
      });
      expect(model.polygons).toHaveLength(2);
      expect(model.polygons[0]!.seriesId).toBe("a");
      expect(model.polygons[1]!.seriesId).toBe("b");
    });

    it("auto-assigns palette colours across series", () => {
      const model = computeRadarChart({
        series: [
          { id: "a", label: "A", rows: A },
          { id: "b", label: "B", rows: B },
        ],
      });
      expect(model.polygons[0]!.fillColor).not.toBe(model.polygons[1]!.fillColor);
    });

    it("respects explicit series.color override", () => {
      const model = computeRadarChart({
        series: [
          { id: "a", label: "A", rows: A, color: "#abcdef" },
          { id: "b", label: "B", rows: B },
        ],
      });
      expect(model.polygons[0]!.fillColor).toBe("#abcdef");
    });

    it("emits a seriesLegend when 2+ labelled series", () => {
      const model = computeRadarChart({
        series: [
          { id: "a", label: "Alpha", rows: A },
          { id: "b", label: "Beta", rows: B },
        ],
      });
      expect(model.seriesLegend).not.toBeNull();
      expect(model.seriesLegend!.items.map((i) => i.label)).toEqual(["Alpha", "Beta"]);
    });

    it("no seriesLegend for single-series input", () => {
      const model = computeRadarChart({ rows: A });
      expect(model.seriesLegend).toBeNull();
    });

    it("warns when rows and series are both supplied; series wins", () => {
      const model = computeRadarChart({
        rows: A,
        series: [{ id: "b", label: "B", rows: B }],
      });
      expect(model.polygons).toHaveLength(1);
      expect(model.polygons[0]!.seriesId).toBe("b");
      expect(model.meta.warnings.some((w) => w.includes("takes precedence"))).toBe(true);
    });

    it("warns when a series has a different metric set from the primary", () => {
      const divergent: RadarChartRow[] = [
        { metric: "Goals", value: 0.3, percentile: 45 },
        { metric: "Tackles", value: 2, percentile: 60 },
      ];
      const model = computeRadarChart({
        series: [
          { id: "a", label: "A", rows: A },
          { id: "b", label: "B", rows: divergent },
        ],
      });
      expect(model.meta.warnings.some((w) => w.includes("different metric set"))).toBe(
        true,
      );
    });
  });
});
