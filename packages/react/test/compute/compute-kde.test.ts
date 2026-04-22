import { describe, expect, it } from "vitest";

import {
  computeKDE,
  kdeGridToRGBA,
  resolveColorStops,
  type KDEEvent,
} from "../../src/compute/index";

function makeEvents(coords: Array<{ x: number; y: number }>): KDEEvent[] {
  return coords.map((c) => ({ x: c.x, y: c.y }));
}

describe("computeKDE", () => {
  it("returns emptyState when events array is empty", () => {
    const model = computeKDE({ events: [] });

    expect(model.meta.empty).toBe(true);
    expect(model.emptyState).toEqual({ message: "No event data" });
    expect(model.scaleBar).toBeNull();
    expect(model.density.grid.length).toBe(0);
  });

  it("computes a density grid for valid events", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 50, y: 50 },
        { x: 52, y: 48 },
        { x: 51, y: 51 },
      ]),
    });

    expect(model.meta.empty).toBe(false);
    expect(model.density.gridWidth).toBe(100);
    expect(model.density.gridHeight).toBeGreaterThan(0);
    expect(model.density.grid.length).toBe(
      model.density.gridWidth * model.density.gridHeight,
    );
    expect(model.density.maxDensity).toBeGreaterThan(0);
  });

  it("uses Silverman bandwidth when bandwidth is auto", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 20, y: 30 },
        { x: 80, y: 70 },
        { x: 50, y: 50 },
      ]),
    });

    expect(model.meta.bandwidthX).toBeGreaterThan(0);
    expect(model.meta.bandwidthY).toBeGreaterThan(0);
  });

  it("uses custom bandwidth when specified", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 50, y: 50 },
        { x: 55, y: 55 },
      ]),
      bandwidth: 7,
    });

    expect(model.meta.bandwidthX).toBe(7);
    expect(model.meta.bandwidthY).toBe(7);
  });

  it("normalizes density to 0-1 by default", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 50, y: 50 }]),
    });

    expect(model.density.maxDensity).toBe(1);
    // All values should be 0-1
    for (let i = 0; i < model.density.grid.length; i++) {
      expect(model.density.grid[i]).toBeLessThanOrEqual(1);
      expect(model.density.grid[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves raw density when normalize is false", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]),
      normalize: false,
    });

    // Max density should be > 1 (sum of 3 overlapping Gaussians)
    expect(model.density.maxDensity).toBeGreaterThan(1);
  });

  it("filters out null and non-finite coordinates", () => {
    const events: KDEEvent[] = [
      { x: 50, y: 50 },
      { x: null as unknown as number, y: 50 },
      { x: 50, y: Number.NaN },
      { x: Number.POSITIVE_INFINITY, y: 20 },
    ];
    const model = computeKDE({ events });

    expect(model.meta.validEvents).toBe(1);
    expect(model.meta.totalEvents).toBe(4);
    expect(model.meta.warnings.length).toBeGreaterThan(0);
  });

  it("warns about sparse data with fewer than 3 events", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 50, y: 50 }]),
    });

    expect(model.meta.warnings.some((w) => w.includes("not be meaningful"))).toBe(true);
  });

  it("respects custom resolution", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 50, y: 50 }]),
      resolution: 50,
    });

    expect(model.density.gridWidth).toBe(50);
    expect(model.density.gridHeight).toBeLessThan(50); // pitch is wider than tall
  });

  it("returns scale-bar metadata without embedding renderer color stops", () => {
    const model = computeKDE({ events: makeEvents([{ x: 50, y: 50 }]) });
    expect(model.scaleBar).not.toBeNull();
    expect(model.scaleBar?.label).toBe("Density");
    expect(model.scaleBar?.domain).toEqual([0, 1]);
  });

  it("passes orientation and crop through to the model", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 50, y: 50 }]),
      attackingDirection: "up",
      crop: "half",
    });

    expect(model.meta.attackingDirection).toBe("up");
    expect(model.meta.crop).toBe("half");
    expect(model.pitch.attackingDirection).toBe("up");
    expect(model.pitch.crop).toBe("half");
  });

  it("produces a hotspot at the event location", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 75, y: 25 }]),
      bandwidth: 5,
    });

    // The grid cell closest to (75, 25) should have the highest density
    const { gridWidth, gridHeight, grid } = model.density;
    const cellW = 100 / gridWidth;
    const cellH = 100 / gridHeight;
    const targetCol = Math.min(gridWidth - 1, Math.floor(75 / cellW));
    const targetRow = Math.min(gridHeight - 1, Math.floor(25 / cellH));
    const targetDensity = grid[targetRow * gridWidth + targetCol] ?? 0;

    expect(targetDensity).toBe(model.density.maxDensity);
  });
});

describe("kdeGridToRGBA", () => {
  it("returns transparent pixels for empty model", () => {
    const model = computeKDE({ events: [] });
    const pixels = kdeGridToRGBA(model, resolveColorStops("magma", undefined));
    expect(pixels.length).toBe(0);
  });

  it("produces RGBA data for non-empty model", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 50, y: 50 },
        { x: 55, y: 55 },
      ]),
    });

    const pixels = kdeGridToRGBA(model, resolveColorStops("magma", undefined));
    expect(pixels.length).toBe(model.density.gridWidth * model.density.gridHeight * 4);

    // At least some pixels should be non-transparent
    let hasOpaque = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if ((pixels[i] ?? 0) > 0) {
        hasOpaque = true;
        break;
      }
    }
    expect(hasOpaque).toBe(true);
  });

  it("respects threshold — low density pixels are transparent", () => {
    const model = computeKDE({
      events: makeEvents([{ x: 50, y: 50 }]),
      threshold: 0.5, // aggressive threshold
    });

    const pixels = kdeGridToRGBA(model, resolveColorStops("magma", undefined));

    // Count transparent vs opaque pixels
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if ((pixels[i] ?? 0) === 0) transparent++;
      else opaque++;
    }

    // With high threshold, most pixels should be transparent
    expect(transparent).toBeGreaterThan(opaque);
  });

  it("accepts renderer-provided color stops", () => {
    const model = computeKDE({
      events: makeEvents([
        { x: 50, y: 50 },
        { x: 55, y: 50 },
        { x: 60, y: 50 },
      ]),
    });

    const pixels = kdeGridToRGBA(model, resolveColorStops("inferno", undefined));
    let hasOpaque = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if ((pixels[i] ?? 0) > 0) {
        hasOpaque = true;
        break;
      }
    }
    expect(hasOpaque).toBe(true);
  });

  it("scales alpha with the provided opacity multiplier", () => {
    const model = computeKDE({ events: makeEvents([{ x: 50, y: 50 }]) });
    const full = kdeGridToRGBA(model, resolveColorStops("magma", undefined), 1);
    const dimmed = kdeGridToRGBA(model, resolveColorStops("magma", undefined), 0.5);

    let compared = false;
    for (let i = 3; i < full.length; i += 4) {
      if ((full[i] ?? 0) > 0) {
        expect(dimmed[i] ?? 0).toBeLessThan(full[i] ?? 0);
        compared = true;
        break;
      }
    }

    expect(compared).toBe(true);
  });
});
