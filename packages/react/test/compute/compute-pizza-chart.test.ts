import { describe, expect, it } from "vitest";

import { computePizzaChart, type PizzaChartRow } from "../../src/compute/index";

function makeRows(
  data: Array<{ metric: string; percentile: number; category?: string }>,
): PizzaChartRow[] {
  return data.map((d) => ({
    metric: d.metric,
    percentile: d.percentile,
    ...(d.category != null ? { category: d.category } : {}),
  }));
}

const STANDARD_ROWS = makeRows([
  { metric: "Goals", percentile: 92, category: "Attacking" },
  { metric: "npxG", percentile: 87, category: "Attacking" },
  { metric: "Shots", percentile: 78, category: "Attacking" },
  { metric: "Passes", percentile: 45, category: "Possession" },
  { metric: "Prog passes", percentile: 38, category: "Possession" },
  { metric: "Carries", percentile: 71, category: "Possession" },
  { metric: "Tackles", percentile: 24, category: "Defending" },
  { metric: "Interceptions", percentile: 18, category: "Defending" },
  { metric: "Pressures", percentile: 62, category: "Defending" },
]);

describe("computePizzaChart", () => {
  // ---- empty / edge states ------------------------------------------------

  it("returns emptyState when rows array is empty", () => {
    const model = computePizzaChart({ rows: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No profile data" });
    expect(model.slices).toHaveLength(0);
    expect(model.labels).toHaveLength(0);
    expect(model.valueBadges).toHaveLength(0);
    expect(model.legend).toBeNull();
  });

  it("excludes rows with missing metric name", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "", percentile: 50 },
        { metric: "Goals", percentile: 92 },
      ],
    });

    expect(model.meta.validRows).toBe(1);
    expect(model.slices).toHaveLength(1);
    expect(model.meta.warnings.some((w) => w.includes("excluded"))).toBe(true);
  });

  it("excludes rows with non-finite percentile", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "Goals", percentile: NaN },
        { metric: "Assists", percentile: Infinity },
        { metric: "Shots", percentile: 78 },
      ],
    });

    expect(model.meta.validRows).toBe(1);
    expect(model.slices).toHaveLength(1);
  });

  it("warns about single metric", () => {
    const model = computePizzaChart({
      rows: [{ metric: "Goals", percentile: 92 }],
    });

    expect(model.meta.warnings.some((w) => w.includes("Single metric"))).toBe(true);
  });

  it("warns about fewer than 4 metrics", () => {
    const model = computePizzaChart({
      rows: makeRows([
        { metric: "A", percentile: 50 },
        { metric: "B", percentile: 60 },
        { metric: "C", percentile: 70 },
      ]),
    });

    expect(model.meta.warnings.some((w) => w.includes("visually weak"))).toBe(true);
  });

  it("warns about dense metrics (>16)", () => {
    const rows = Array.from({ length: 18 }, (_, i) => ({
      metric: `Metric ${i}`,
      percentile: 50 + i,
    }));
    const model = computePizzaChart({ rows });

    expect(model.meta.warnings.some((w) => w.includes("dense"))).toBe(true);
  });

  // ---- slice geometry -----------------------------------------------------

  it("creates one slice per valid metric", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });

    expect(model.slices).toHaveLength(9);
    expect(model.meta.empty).toBe(false);
  });

  it("slices span 2π total (with gaps)", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
    });

    const slices = model.slices;
    const firstStart = slices[0]!.startAngle;
    const lastEnd = slices[slices.length - 1]!.endAngle;
    const totalArc = lastEnd - firstStart;

    // Should be close to 2π (allowing for category gaps)
    expect(totalArc).toBeGreaterThan(Math.PI * 1.9);
    expect(totalArc).toBeLessThanOrEqual(2 * Math.PI);
  });

  it("clamps percentile to 0-100", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "Over", percentile: 150 },
        { metric: "Under", percentile: -20 },
        { metric: "Normal", percentile: 50 },
      ],
    });

    expect(model.slices[0]!.percentile).toBe(100);
    expect(model.slices[1]!.percentile).toBe(0);
    expect(model.slices[2]!.percentile).toBe(50);
  });

  it("outerRadius scales with percentile", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "High", percentile: 100 },
        { metric: "Low", percentile: 0 },
        { metric: "Mid", percentile: 50 },
      ],
    });

    const highSlice = model.slices.find((s) => s.metric === "High")!;
    const lowSlice = model.slices.find((s) => s.metric === "Low")!;
    const midSlice = model.slices.find((s) => s.metric === "Mid")!;

    expect(highSlice.outerRadius).toBeGreaterThan(midSlice.outerRadius);
    expect(midSlice.outerRadius).toBeGreaterThan(lowSlice.outerRadius);
    // 0 percentile → outerRadius equals innerRadius
    expect(lowSlice.outerRadius).toBe(lowSlice.innerRadius);
  });

  // ---- category grouping --------------------------------------------------

  it("assigns fill color from category palette", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
    });

    const attackingSlice = model.slices.find((s) => s.category === "Attacking")!;
    const possessionSlice = model.slices.find((s) => s.category === "Possession")!;
    const defendingSlice = model.slices.find((s) => s.category === "Defending")!;

    // Different categories should have different colors
    expect(attackingSlice.fillColor).not.toBe(possessionSlice.fillColor);
    expect(possessionSlice.fillColor).not.toBe(defendingSlice.fillColor);
  });

  it("honors an explicit categoryColors input", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
      categoryColors: ["#ff0000", "#00ff00", "#0000ff"],
    });

    const attackingSlice = model.slices.find((s) => s.category === "Attacking")!;
    const possessionSlice = model.slices.find((s) => s.category === "Possession")!;
    const defendingSlice = model.slices.find((s) => s.category === "Defending")!;

    expect(attackingSlice.fillColor).toBe("#ff0000");
    expect(possessionSlice.fillColor).toBe("#00ff00");
    expect(defendingSlice.fillColor).toBe("#0000ff");
  });

  it("renders a single-color pizza when categoryColors has one entry", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      categoryColors: ["#6366f1"],
    });

    // All slices share the same color, regardless of category
    const fillColors = new Set(model.slices.map((s) => s.fillColor));
    expect(fillColors.size).toBe(1);
    expect(fillColors.has("#6366f1")).toBe(true);
  });

  it("uses default category for uncategorized rows", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "Goals", percentile: 92 },
        { metric: "Assists", percentile: 45 },
      ],
    });

    expect(model.slices[0]!.category).toBe("Uncategorized");
    expect(model.slices[1]!.category).toBe("Uncategorized");
  });

  it("inserts category gaps between groups", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      categoryOrder: ["Attacking", "Possession", "Defending"],
    });

    // Find boundary between Attacking and Possession
    const lastAttacking = model.slices.filter((s) => s.category === "Attacking").pop()!;
    const firstPossession = model.slices.find((s) => s.category === "Possession")!;

    const gap = firstPossession.startAngle - lastAttacking.endAngle;
    expect(gap).toBeGreaterThan(0); // There should be a gap
  });

  // ---- metric ordering ----------------------------------------------------

  it("respects explicit metricOrder", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      metricOrder: ["Pressures", "Goals", "Tackles"],
    });

    expect(model.slices[0]!.metric).toBe("Pressures");
    expect(model.slices[1]!.metric).toBe("Goals");
    expect(model.slices[2]!.metric).toBe("Tackles");
  });

  // ---- labels and badges --------------------------------------------------

  it("generates labels for each metric by default", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });

    expect(model.labels).toHaveLength(9);
    expect(model.labels[0]!.metric).toBe(model.slices[0]!.metric);
  });

  it("hides labels when showAxisLabels is false", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      showAxisLabels: false,
    });

    expect(model.labels).toHaveLength(0);
  });

  it("generates value badges for non-zero percentiles", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "Goals", percentile: 92 },
        { metric: "Zero", percentile: 0 },
      ],
    });

    // Only 1 badge (percentile > 0)
    expect(model.valueBadges).toHaveLength(1);
    expect(model.valueBadges[0]!.text).toBe("92");
  });

  it("hides value badges when showValueBadges is false", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      showValueBadges: false,
    });

    expect(model.valueBadges).toHaveLength(0);
  });

  it("uses displayValue from row when provided", () => {
    const model = computePizzaChart({
      rows: [{ metric: "Goals", percentile: 92, displayValue: "0.68 per 90" }],
    });

    expect(model.slices[0]!.displayValue).toBe("0.68 per 90");
    expect(model.valueBadges[0]!.text).toBe("0.68 per 90");
  });

  // ---- legend control -----------------------------------------------------

  it("auto-shows category legend when multiple categories exist", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });

    expect(model.legend).not.toBeNull();
    expect(model.legend!.items.length).toBeGreaterThan(1);
  });

  it("hides legend when showLegend is false", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      showLegend: false,
    });

    expect(model.legend).toBeNull();
  });

  it("hides legend for single-category profiles by default", () => {
    const model = computePizzaChart({
      rows: makeRows([
        { metric: "A", percentile: 50 },
        { metric: "B", percentile: 60 },
      ]),
    });

    // Single category (Uncategorized) → no legend
    expect(model.legend).toBeNull();
  });

  it("honors showLegend: true on a single-category profile (1-item legend)", () => {
    const model = computePizzaChart({
      rows: makeRows([
        { metric: "A", percentile: 50 },
        { metric: "B", percentile: 60 },
      ]),
      showLegend: true,
    });

    // Explicit override beats the default auto-hide
    expect(model.legend).not.toBeNull();
    expect(model.legend!.items).toHaveLength(1);
    expect(model.legend!.items[0]!.label).toBe("Uncategorized");
  });

  // ---- geometry -----------------------------------------------------------

  it("has consistent geometry constants", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });

    expect(model.geometry.viewBoxSize).toBe(400);
    expect(model.geometry.center).toBe(200);
    expect(model.geometry.outerRadius).toBe(140);
    expect(model.geometry.innerRadius).toBeGreaterThan(0);
    expect(model.geometry.innerRadius).toBeLessThan(model.geometry.outerRadius);
    expect(model.geometry.labelRadius).toBeGreaterThan(model.geometry.outerRadius);
  });

  // ---- center content passthrough -----------------------------------------

  it("passes centerContent through to model", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      centerContent: { kind: "initials", label: "BS" },
    });

    expect(model.centerContent).toEqual({ kind: "initials", label: "BS" });
  });

  it("defaults centerContent to null", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });
    expect(model.centerContent).toBeNull();
  });

  // ---- accessible label ---------------------------------------------------

  it("generates accessible label with metric count", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });
    expect(model.meta.accessibleLabel).toContain("9 metrics");
  });

  it("generates accessible label for empty state", () => {
    const model = computePizzaChart({ rows: [] });
    expect(model.meta.accessibleLabel).toContain("no profile data");
  });

  // ---- grid rings ---------------------------------------------------------

  it("defaults to 4 grid rings at 25% step", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });

    expect(model.gridRings).toHaveLength(4);
    expect(model.gridRings.map((r) => r.percentile)).toEqual([25, 50, 75, 100]);
    expect(model.gridRings.map((r) => r.radiusFraction)).toEqual([0.25, 0.5, 0.75, 1.0]);
  });

  it("generates 5 grid rings with gridRingStep: 20", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: 20 });

    expect(model.gridRings).toHaveLength(5);
    expect(model.gridRings.map((r) => r.percentile)).toEqual([20, 40, 60, 80, 100]);
  });

  it("generates 2 grid rings with gridRingStep: 50", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: 50 });

    expect(model.gridRings).toHaveLength(2);
    expect(model.gridRings.map((r) => r.percentile)).toEqual([50, 100]);
  });

  it("always includes 100% ring even when step doesn't divide evenly", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: 30 });

    const percentiles = model.gridRings.map((r) => r.percentile);
    expect(percentiles).toEqual([30, 60, 90, 100]);
    expect(percentiles[percentiles.length - 1]).toBe(100);
  });

  it("computes grid rings without carrying renderer-local style state", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });
    expect(model.gridRings.length).toBeGreaterThan(0);
  });

  it("returns empty gridRings for empty model", () => {
    const model = computePizzaChart({ rows: [] });
    expect(model.gridRings).toEqual([]);
  });

  it("falls back to default gridRingStep with a warning when given zero", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: 0 });
    expect(model.gridRings.map((r) => r.percentile)).toEqual([25, 50, 75, 100]);
    expect(model.meta.warnings.some((w) => w.includes("gridRingStep"))).toBe(true);
  });

  it("falls back to default gridRingStep with a warning when given a negative", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: -1 });
    expect(model.gridRings.map((r) => r.percentile)).toEqual([25, 50, 75, 100]);
    expect(model.meta.warnings.some((w) => w.includes("gridRingStep"))).toBe(true);
  });

  it("falls back to default gridRingStep with a warning when given NaN", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS, gridRingStep: NaN });
    expect(model.gridRings.map((r) => r.percentile)).toEqual([25, 50, 75, 100]);
    expect(model.meta.warnings.some((w) => w.includes("gridRingStep"))).toBe(true);
  });

  // ---- reference sets -----------------------------------------------------

  it("computes reference arcs for a single set", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [
        {
          label: "League Median",
          values: { Goals: 50, npxG: 50, Shots: 50 },
        },
      ],
    });

    expect(model.referenceSets).toHaveLength(1);
    expect(model.referenceSets[0]!.label).toBe("League Median");
    expect(model.referenceSets[0]!.arcs).toHaveLength(3);

    // Each arc should match its slice's angles
    const goalsArc = model.referenceSets[0]!.arcs.find((a) => a.metric === "Goals")!;
    const goalsSlice = model.slices.find((s) => s.metric === "Goals")!;
    expect(goalsArc.startAngle).toBe(goalsSlice.startAngle);
    expect(goalsArc.endAngle).toBe(goalsSlice.endAngle);
  });

  it("drops reference-arc entries with NaN/Infinity benchmark values", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [
        {
          label: "Sparse Cohort",
          values: { Goals: 50, npxG: NaN, Shots: Infinity },
        },
      ],
    });

    expect(model.referenceSets).toHaveLength(1);
    const arcs = model.referenceSets[0]!.arcs;
    expect(arcs.map((a) => a.metric)).toEqual(["Goals"]);
    for (const arc of arcs) {
      expect(Number.isFinite(arc.percentile)).toBe(true);
      expect(Number.isFinite(arc.radius)).toBe(true);
    }
  });

  it("supports multiple reference sets", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [
        { label: "Median", values: { Goals: 50 } },
        { label: "Top 10", values: { Goals: 90 }, stroke: "#ff0000" },
      ],
    });

    expect(model.referenceSets).toHaveLength(2);
    expect(model.referenceSets[0]!.index).toBe(0);
    expect(model.referenceSets[1]!.index).toBe(1);
    expect(model.referenceSets[1]!.stroke).toBe("#ff0000");
  });

  it("only creates arcs for metrics present in the chart", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [
        {
          values: { Goals: 50, "Not a metric": 75, Shots: 60 },
        },
      ],
    });

    // "Not a metric" should be silently skipped
    expect(model.referenceSets[0]!.arcs).toHaveLength(2);
    expect(model.referenceSets[0]!.arcs.map((a) => a.metric).sort()).toEqual([
      "Goals",
      "Shots",
    ]);
  });

  it("clamps reference percentiles to 0-100", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [{ values: { Goals: 150, npxG: -20 } }],
    });

    const arcs = model.referenceSets[0]!.arcs;
    expect(arcs.find((a) => a.metric === "Goals")!.percentile).toBe(100);
    expect(arcs.find((a) => a.metric === "npxG")!.percentile).toBe(0);
  });

  it("reference arc radius matches slice radius at same percentile", () => {
    const model = computePizzaChart({
      rows: [
        { metric: "A", percentile: 50 },
        { metric: "B", percentile: 70 },
      ],
      referenceSets: [{ values: { A: 50, B: 70 } }],
    });

    const sliceA = model.slices.find((s) => s.metric === "A")!;
    const arcA = model.referenceSets[0]!.arcs.find((a) => a.metric === "A")!;
    expect(arcA.radius).toBeCloseTo(sliceA.outerRadius, 6);

    const sliceB = model.slices.find((s) => s.metric === "B")!;
    const arcB = model.referenceSets[0]!.arcs.find((a) => a.metric === "B")!;
    expect(arcB.radius).toBeCloseTo(sliceB.outerRadius, 6);
  });

  it("passes reference set styling through to model", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [
        {
          label: "Test",
          values: { Goals: 50 },
          stroke: "#abcdef",
          strokeWidth: 2,
          strokeDasharray: "4 2",
        },
      ],
    });

    const set = model.referenceSets[0]!;
    expect(set.label).toBe("Test");
    expect(set.stroke).toBe("#abcdef");
    expect(set.strokeWidth).toBe(2);
    expect(set.strokeDasharray).toBe("4 2");
  });

  it("defaults reference styling to null when omitted", () => {
    const model = computePizzaChart({
      rows: STANDARD_ROWS,
      referenceSets: [{ values: { Goals: 50 } }],
    });

    const set = model.referenceSets[0]!;
    expect(set.label).toBeNull();
    expect(set.stroke).toBeNull();
    expect(set.strokeWidth).toBeNull();
    expect(set.strokeDasharray).toBeNull();
  });

  it("returns empty referenceSets for empty model", () => {
    const model = computePizzaChart({ rows: [] });
    expect(model.referenceSets).toEqual([]);
  });

  it("returns empty referenceSets when none provided", () => {
    const model = computePizzaChart({ rows: STANDARD_ROWS });
    expect(model.referenceSets).toEqual([]);
  });
});
