import { describe, expect, it } from "vitest";

import {
  computeDistributionChart,
  computeDistributionComparison,
} from "../../src/compute/index";

describe("computeDistributionChart", () => {
  it("returns an empty state when no valid numeric values exist", () => {
    const model = computeDistributionChart({
      series: [
        { id: "a", label: "A", values: [null, undefined, Number.NaN] },
        { id: "b", label: "B", values: [] },
      ],
      xLabel: "Shots per match",
    });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No plottable distribution data" });
    expect(model.plot.series).toEqual([]);
  });

  it("computes projected series and a default median marker", () => {
    const model = computeDistributionChart({
      series: [
        {
          id: "liv",
          label: "Liverpool",
          values: [8, 10, 12, 13, 14, 16, 18, 19, 22],
        },
      ],
      xLabel: "Shots per match",
      defaultMarker: "median",
    });

    expect(model.meta.empty).toBe(false);
    expect(model.plot.series).toHaveLength(1);
    expect(model.plot.series[0]?.linePath).toContain("M");
    expect(model.plot.series[0]?.areaPath).toContain("Z");
    expect(model.plot.series[0]?.marker?.source).toBe("median");
    expect(model.plot.series[0]?.marker?.value).toBe(14);
  });

  it("uses an explicit marker value when supplied on the series", () => {
    const model = computeDistributionChart({
      series: [
        {
          id: "liv",
          label: "Liverpool",
          values: [0.7, 0.8, 1.0, 1.2, 1.4],
          markerValue: 1.1,
        },
      ],
      xLabel: "Non-penalty xG",
      defaultMarker: "mean",
    });

    expect(model.plot.series[0]?.marker?.source).toBe("value");
    expect(model.plot.series[0]?.marker?.value).toBe(1.1);
  });

  it("warns when values are sparse or invalid", () => {
    const model = computeDistributionChart({
      series: [
        {
          id: "a",
          label: "Sparse A",
          values: [10, 12, null, undefined],
        },
      ],
    });

    expect(model.meta.warnings.some((warning) => warning.includes("excluded"))).toBe(
      true,
    );
    expect(
      model.meta.warnings.some((warning) => warning.includes("may not be meaningful")),
    ).toBe(true);
  });

  it("pads degenerate domains instead of collapsing them", () => {
    const model = computeDistributionChart({
      series: [
        {
          id: "flat",
          label: "Flat",
          values: [12, 12, 12, 12],
        },
      ],
    });

    expect(model.axes.x.domain[0]).toBeLessThan(12);
    expect(model.axes.x.domain[1]).toBeGreaterThan(12);
  });
});

describe("computeDistributionComparison", () => {
  const rows = [
    {
      id: "shots",
      label: "Shots",
      series: [
        { id: "liv", label: "Liverpool", values: [8, 10, 12, 14, 16, 18, 22] },
        { id: "mci", label: "Man City", values: [9, 11, 13, 15, 17, 20, 24] },
      ],
    },
    {
      id: "psxg-added",
      label: "PSxG added",
      series: [
        { id: "liv", label: "Liverpool", values: [-0.2, -0.1, -0.05, 0, 0.04, 0.08] },
        { id: "mci", label: "Man City", values: [-0.15, -0.06, -0.02, 0.03, 0.05, 0.1] },
      ],
    },
  ] as const;

  it("creates stacked rows with independent x domains", () => {
    const model = computeDistributionComparison({
      rows,
      defaultMarker: "mean",
    });

    expect(model.meta.empty).toBe(false);
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0]?.label).toBe("Shots");
    expect(model.rows[1]?.label).toBe("PSxG added");
    expect(model.rows[0]?.xAxis.domain).not.toEqual(model.rows[1]?.xAxis.domain);
  });

  it("supports shared row scaling when requested", () => {
    const independent = computeDistributionComparison({
      rows,
      rowScale: "independent",
    });
    const shared = computeDistributionComparison({
      rows,
      rowScale: "shared",
    });

    expect(independent.rows[0]?.yDomain).not.toEqual(independent.rows[1]?.yDomain);
    expect(shared.rows[0]?.yDomain).toEqual(shared.rows[1]?.yDomain);
  });
});
