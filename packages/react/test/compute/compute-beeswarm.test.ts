import { describe, expect, it } from "vitest";
import { computeBeeswarm } from "../../src/compute/beeswarm.js";

const SIMPLE_GROUP = {
  id: "s1",
  label: "2023",
  values: Array.from({ length: 20 }, (_, i) => ({
    id: `p-${i}`,
    value: i * 0.05,
  })),
};

describe("computeBeeswarm", () => {
  it("returns empty state with a stable viewBox when there is no data", () => {
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values: [] }],
      metric: { label: "metric" },
    });
    expect(model.meta.empty).toBe(true);
    expect(model.emptyState?.message).toBeTruthy();
    expect(model.layout.viewBox.width).toBeGreaterThan(0);
    expect(model.layout.viewBox.height).toBeGreaterThan(0);
    expect(model.groups[0]!.dots).toHaveLength(0);
    expect(model.groups[0]!.highlights).toHaveLength(0);
  });

  it("drops non-finite values and emits warnings", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "a", value: 0.5 },
            { id: "b", value: Number.NaN },
            { id: "c", value: Infinity },
          ],
        },
      ],
      metric: { label: "metric" },
    });
    expect(model.groups[0]!.dots).toHaveLength(1);
    expect(model.meta.warnings.length).toBeGreaterThan(0);
  });

  it("packs dots inside the plot area (horizontal)", () => {
    const model = computeBeeswarm({
      orientation: "horizontal",
      groups: [SIMPLE_GROUP],
      metric: { label: "xG/90" },
    });
    const plot = model.groups[0]!.plotArea;
    for (const dot of model.groups[0]!.dots) {
      expect(dot.cx).toBeGreaterThanOrEqual(plot.x - 0.001);
      expect(dot.cx).toBeLessThanOrEqual(plot.x + plot.width + 0.001);
      expect(dot.cy).toBeGreaterThanOrEqual(plot.y - 0.001);
      expect(dot.cy).toBeLessThanOrEqual(plot.y + plot.height + 0.001);
    }
  });

  it("inverts the Y axis for vertical orientation (higher value => smaller y)", () => {
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "lo", value: 0.1 },
            { id: "hi", value: 0.9 },
          ],
        },
      ],
      metric: { label: "metric", domain: [0, 1] },
    });
    const dots = model.groups[0]!.dots;
    const lo = dots.find((d) => d.id === "lo")!;
    const hi = dots.find((d) => d.id === "hi")!;
    expect(hi.cy).toBeLessThan(lo.cy);
  });

  it("applies byCategory colouring", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "a", value: 0.2, category: "PL" },
            { id: "b", value: 0.4, category: "UCL" },
          ],
        },
      ],
      metric: { label: "m" },
      populationColor: {
        mode: "byCategory",
        colors: { PL: "#111111", UCL: "#222222" },
      },
    });
    const byId = Object.fromEntries(model.groups[0]!.dots.map((d) => [d.id, d.fill]));
    expect(byId["a"]).toBe("#111111");
    expect(byId["b"]).toBe("#222222");
    expect(model.legend?.items.some((it) => it.label === "PL")).toBe(true);
  });

  it("applies byQuantile colouring with the above bucket", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "lo", value: 0.05 },
            { id: "mid", value: 0.5 },
            { id: "hi", value: 0.95 },
          ],
        },
      ],
      metric: { label: "m" },
      populationColor: {
        mode: "byQuantile",
        bands: [
          { threshold: 0.1, color: "#ff0000" },
          { threshold: 0.6, color: "#ffff00" },
        ],
        aboveColor: "#00ff00",
      },
    });
    const byId = Object.fromEntries(model.groups[0]!.dots.map((d) => [d.id, d.fill]));
    expect(byId["lo"]).toBe("#ff0000");
    expect(byId["mid"]).toBe("#ffff00");
    expect(byId["hi"]).toBe("#00ff00");
  });

  it("emits highlight models with labels and callouts on request", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "p", value: 0.3 },
            {
              id: "star",
              value: 0.7,
              label: "Star",
              highlight: { color: "#ff6600" },
            },
          ],
        },
      ],
      metric: { label: "m" },
      labelStrategy: "callout",
    });
    expect(model.groups[0]!.dots.map((d) => d.id)).toEqual(["p"]);
    expect(model.groups[0]!.highlights).toHaveLength(1);
    const h = model.groups[0]!.highlights[0]!;
    expect(h.label?.text).toBe("Star");
    expect(h.callout).not.toBeNull();
    expect(h.fill).toBe("#ff6600");
  });

  it("places reference lines across the plot strip", () => {
    const model = computeBeeswarm({
      groups: [SIMPLE_GROUP],
      metric: { label: "m" },
      referenceLines: [{ value: 0.5, label: "median" }],
    });
    expect(model.referenceLines).toHaveLength(1);
    const r = model.referenceLines[0]!;
    expect(r.label).toBe("median");
    expect(r.x1).toBeGreaterThan(0);
  });

  it("sizes dots from a size field when configured", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "small", value: 0.2, size: 10 },
            { id: "big", value: 0.3, size: 200 },
          ],
        },
      ],
      metric: { label: "m" },
      sizeField: { range: [2, 10] },
    });
    const byId = Object.fromEntries(model.groups[0]!.dots.map((d) => [d.id, d.r]));
    expect(byId["big"]).toBeGreaterThan(byId["small"]!);
  });

  it("clamps values outside the explicit domain inside the plot area and warns", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "inside", value: 0.5 },
            { id: "escapee", value: 5 },
          ],
        },
      ],
      metric: { label: "m", domain: [0, 1] },
    });
    const plot = model.groups[0]!.plotArea;
    const escapee = model.groups[0]!.dots.find((d) => d.id === "escapee")!;
    // Even though value=5 would map far beyond majorEnd, the packer must
    // keep it inside the plot area.
    expect(escapee.cx).toBeLessThanOrEqual(plot.x + plot.width + 0.001);
    expect(escapee.cx).toBeGreaterThanOrEqual(plot.x - 0.001);
    expect(model.meta.warnings.some((w) => w.includes("outside metric.domain"))).toBe(
      true,
    );
  });

  it("sorts byQuantile bands defensively so unsorted input still colours correctly", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "lo", value: 0.05 },
            { id: "mid", value: 0.3 },
            { id: "hi", value: 0.9 },
          ],
        },
      ],
      metric: { label: "m" },
      populationColor: {
        mode: "byQuantile",
        // Intentionally unsorted — was silently mis-colouring before the fix.
        bands: [
          { threshold: 0.5, color: "#ffff00" },
          { threshold: 0.1, color: "#ff0000" },
        ],
        aboveColor: "#00ff00",
      },
    });
    const byId = Object.fromEntries(model.groups[0]!.dots.map((d) => [d.id, d.fill]));
    expect(byId["lo"]).toBe("#ff0000");
    expect(byId["mid"]).toBe("#ffff00");
    expect(byId["hi"]).toBe("#00ff00");
  });

  it("exposes an axis labelAnchor that stays clear of tick labels as axisSize grows", () => {
    const narrow = computeBeeswarm({
      orientation: "vertical",
      groups: [{ id: "g", label: "G", values: [{ id: "a", value: 0.5 }] }],
      metric: { label: "m" },
      layout: { axisSize: 20 },
    });
    const wide = computeBeeswarm({
      orientation: "vertical",
      groups: [{ id: "g", label: "G", values: [{ id: "a", value: 0.5 }] }],
      metric: { label: "m" },
      layout: { axisSize: 80 },
    });
    // Label anchor should sit inside the outer padding regardless of axisSize.
    expect(narrow.axis.labelAnchor.x).toBeLessThan(narrow.axis.line.x1);
    expect(wide.axis.labelAnchor.x).toBeLessThan(wide.axis.line.x1);
  });

  it("includes highlight arc in the accessible label", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "s1",
          label: "23-24",
          values: [
            { id: "a", value: 0.2 },
            {
              id: "star",
              value: 0.5,
              label: "Saka",
              highlight: { label: "0.52" },
            },
          ],
        },
      ],
      metric: { label: "npxG" },
    });
    expect(model.meta.accessibleLabel).toContain("23-24");
    expect(model.meta.accessibleLabel).toContain("0.52");
  });

  it("places the highlight label inside the plot when value is near domainMax (no overflow)", () => {
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            {
              id: "top",
              value: 0.99,
              label: "Top",
              highlight: { label: "0.99" },
            },
          ],
        },
      ],
      metric: { label: "m", domain: [0, 1] },
    });
    const h = model.groups[0]!.highlights[0]!;
    const plot = model.groups[0]!.plotArea;
    expect(h.label).not.toBeNull();
    expect(h.label!.y).toBeGreaterThanOrEqual(plot.y - 0.001);
    expect(h.label!.y).toBeLessThanOrEqual(plot.y + plot.height + 0.001);
  });

  it("emits gridlines at each axis tick by default (vertical)", () => {
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [{ id: "g", label: "G", values: [{ id: "a", value: 0.5 }] }],
      metric: { label: "m", domain: [0, 1] },
    });
    expect(model.gridlines.length).toBe(model.axis.ticks.length);
    // Vertical gridlines run horizontally across the plot.
    for (const g of model.gridlines) {
      expect(g.y1).toBe(g.y2);
      expect(g.x2).toBeGreaterThan(g.x1);
    }
  });

  it("suppresses gridlines when showGridlines is false", () => {
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values: [{ id: "a", value: 0.5 }] }],
      metric: { label: "m" },
      showGridlines: false,
    });
    expect(model.gridlines).toEqual([]);
  });

  it("pins highlighted values to the cross-axis centerline with highlightPlacement='centered' (vertical)", () => {
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "a", value: 0.1 },
            { id: "b", value: 0.4 },
            { id: "star", value: 0.5, label: "Star", highlight: {} },
          ],
        },
      ],
      metric: { label: "m", domain: [0, 1] },
      highlightPlacement: "centered",
    });
    const plot = model.groups[0]!.plotArea;
    const star = model.groups[0]!.highlights[0]!;
    const centerX = plot.x + plot.width / 2;
    expect(Math.abs(star.cx - centerX)).toBeLessThan(0.5);
  });

  it("packs values into discrete bins with packing='bin'", () => {
    const values = Array.from({ length: 40 }, (_, i) => ({
      id: `v-${i}`,
      // Exactly five distinct values so bin packing shows obvious stacks.
      value: [0.1, 0.3, 0.5, 0.7, 0.9][i % 5]!,
    }));
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      packing: "bin",
    });
    // All dots with the same input value should land at the same cx (bin center).
    const byValue = new Map<number, Set<number>>();
    for (const d of model.groups[0]!.dots) {
      const set = byValue.get(d.value) ?? new Set<number>();
      set.add(Math.round(d.cx * 100) / 100);
      byValue.set(d.value, set);
    }
    for (const set of byValue.values()) expect(set.size).toBe(1);
  });

  it("staggers callout labels so nearby highlights don't share a y", () => {
    const values = Array.from({ length: 6 }, (_, i) => ({
      id: `h-${i}`,
      value: 0.5 + i * 0.002, // cluster tightly
      label: `Player ${i}`,
      highlight: {},
    }));
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      labelStrategy: "callout",
    });
    const ys = model.groups[0]!.highlights.map((h) => h.label!.y);
    const uniqueYs = new Set(ys);
    // At least two distinct tiers produced for 6 tightly-clustered labels.
    expect(uniqueYs.size).toBeGreaterThan(1);
  });

  it("centered highlight is collision-avoided by the population (no dot overlaps the highlight)", () => {
    const values: Array<{
      id: string;
      value: number;
      label?: string;
      highlight?: { color?: string };
    }> = Array.from({ length: 60 }, (_, i) => ({
      id: `v-${i}`,
      value: 0.5 + (i % 5) * 0.01,
    }));
    values.push({
      id: "star",
      value: 0.52,
      label: "Star",
      highlight: { color: "#f0f" },
    });
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      highlightPlacement: "centered",
      dotRadius: 1.5,
      dotPadding: 0.2,
    });
    const star = model.groups[0]!.highlights[0]!;
    for (const d of model.groups[0]!.dots) {
      const dx = d.cx - star.cx;
      const dy = d.cy - star.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(d.r + star.r - 0.01);
    }
  });

  it("random placement produces distinct positions for multiple highlights with empty ids", () => {
    const values = [
      { id: "", value: 0.4, label: "A", highlight: {} },
      { id: "", value: 0.5, label: "B", highlight: {} },
      { id: "", value: 0.6, label: "C", highlight: {} },
    ];
    const model = computeBeeswarm({
      orientation: "vertical",
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      highlightPlacement: "random",
    });
    const ys = model.groups[0]!.highlights.map((h) => h.cx);
    expect(new Set(ys).size).toBe(3);
  });

  it("bin packing emits an overflow warning when a bucket exceeds the cross-axis range", () => {
    const values = Array.from({ length: 60 }, (_, i) => ({
      id: `v-${i}`,
      value: 0.5,
    }));
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      packing: "bin",
      dotRadius: 2,
      dotPadding: 0.5,
      layout: { viewBoxHeight: 200 },
    });
    expect(model.meta.warnings.some((w) => w.includes("clamped onto the edge"))).toBe(
      true,
    );
  });

  it("byCategory with an unmapped category adds an 'Other' legend swatch", () => {
    const model = computeBeeswarm({
      groups: [
        {
          id: "g",
          label: "G",
          values: [
            { id: "a", value: 0.2, category: "Premier League" },
            { id: "b", value: 0.4, category: "Serie A" },
          ],
        },
      ],
      metric: { label: "m" },
      populationColor: {
        mode: "byCategory",
        colors: { "Premier League": "#b91c1c" },
        defaultColor: "#6b7280",
      },
    });
    expect(model.legend?.items.some((it) => it.label === "Other")).toBe(true);
  });

  it("staggerCalloutLabels uses the configured labelFontSize to size its tier steps", () => {
    const values = Array.from({ length: 4 }, (_, i) => ({
      id: `h-${i}`,
      value: 0.5 + i * 0.003,
      label: `Player ${i}`,
      highlight: {},
    }));
    const small = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      labelStrategy: "callout",
      labelFontSize: 10,
    });
    const large = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      labelStrategy: "callout",
      labelFontSize: 16,
    });
    // With a larger label font, each tier step grows; total y-range of labels
    // should be wider.
    const rangeY = (model: ReturnType<typeof computeBeeswarm>) => {
      const ys = model.groups[0]!.highlights.map((h) => h.label!.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(rangeY(large)).toBeGreaterThan(rangeY(small));
  });

  it("packs a large cohort (2000 dots) in under 200ms — O(n) spatial-grid path", () => {
    const values = Array.from({ length: 2000 }, (_, i) => ({
      id: `v-${i}`,
      value: Math.abs(Math.sin(i * 0.13)) * 0.9 + 0.05,
    }));
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m", domain: [0, 1] },
      dotRadius: 1.5,
      dotPadding: 0.2,
    });
    const elapsed =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
    expect(model.groups[0]!.dots.length).toBe(2000);
    expect(elapsed).toBeLessThan(200);
  });

  it("no overlaps between packed dots (within tolerance)", () => {
    const values = Array.from({ length: 80 }, (_, i) => ({
      id: `v-${i}`,
      value: Math.sin(i * 0.7) * 0.4 + 0.5,
    }));
    const model = computeBeeswarm({
      groups: [{ id: "g", label: "G", values }],
      metric: { label: "m" },
      dotRadius: 2,
      dotPadding: 0.2,
    });
    const dots = model.groups[0]!.dots;
    const tol = 0.05;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i]!;
        const b = dots[j]!;
        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.r + b.r;
        expect(dist + tol).toBeGreaterThanOrEqual(minDist);
      }
    }
  });
});
