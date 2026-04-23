import { describe, expect, it } from "vitest";

import { kdeGridToRGBA, type KDEModel } from "../src/compute/index.js";

import { buildKDERasterData, densityToDataURL } from "../src/kdeRaster";

const stops = [
  { offset: 0, color: "#000000" },
  { offset: 1, color: "#ffffff" },
] as const;

function makeModel({
  attackingDirection,
  gridWidth,
  gridHeight,
  grid,
}: {
  attackingDirection: "up" | "down" | "left" | "right";
  gridWidth: number;
  gridHeight: number;
  grid: number[];
}): KDEModel {
  const maxDensity = Math.max(0, ...grid);

  return {
    meta: {
      component: "KDE",
      empty: gridWidth === 0 || gridHeight === 0,
      attackingDirection,
      crop: "full",
      warnings: [],
      totalEvents: grid.length,
      validEvents: grid.length,
      bandwidthX: 5,
      bandwidthY: 5,
    },
    density: {
      gridWidth,
      gridHeight,
      grid: new Float64Array(grid),
      maxDensity,
      threshold: 0,
    },
    scaleBar:
      gridWidth === 0 || gridHeight === 0
        ? null
        : {
            label: "Density",
            domain: [0, maxDensity],
          },
    pitch: {
      crop: "full",
      attackingDirection,
    },
    emptyState: gridWidth === 0 || gridHeight === 0 ? { message: "No event data" } : null,
  };
}

function readPixel(pixels: Uint8ClampedArray, width: number, row: number, col: number) {
  const offset = (row * width + col) * 4;
  return Array.from(pixels.slice(offset, offset + 4));
}

describe("kdeRaster", () => {
  it("returns null for empty raster dimensions", () => {
    const model = makeModel({
      attackingDirection: "right",
      gridWidth: 0,
      gridHeight: 0,
      grid: [],
    });

    expect(buildKDERasterData(model, stops)).toBeNull();
  });

  it("preserves dimensions and pixel order for horizontal rasters", () => {
    const model = makeModel({
      attackingDirection: "right",
      gridWidth: 2,
      gridHeight: 1,
      grid: [0.25, 1],
    });

    const raster = buildKDERasterData(model, [...stops]);
    const sourcePixels = kdeGridToRGBA(model, [...stops]);

    expect(raster?.width).toBe(2);
    expect(raster?.height).toBe(1);
    expect(Array.from(raster?.pixels ?? [])).toEqual(Array.from(sourcePixels));
  });

  it("transposes vertical rasters so pitch x becomes the image vertical axis (up)", () => {
    // Source grid: gridWidth=2 (camposX cols: 0=own half, 1=opp half),
    // gridHeight=3 (camposY rows: 0=attacker right, 2=attacker left).
    // "up" projection: camposX=100 → svg top, camposY=0 → svg right.
    // ⇒ raster top-left = camposX=100 (opp goal) & camposY=100 (attacker left)
    //                   = source (srcRow=2, srcCol=1).
    const model = makeModel({
      attackingDirection: "up",
      gridWidth: 2,
      gridHeight: 3,
      grid: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    });

    const raster = buildKDERasterData(model, [...stops]);
    const sourcePixels = kdeGridToRGBA(model, [...stops]);

    expect(raster?.width).toBe(3);
    expect(raster?.height).toBe(2);
    // Top row of raster = opposition-half col (srcCol=1), iterating camposY
    // from left (attacker left, srcRow=2) to right (attacker right, srcRow=0).
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 0, 0)).toEqual(
      readPixel(sourcePixels, 2, 2, 1),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 0, 1)).toEqual(
      readPixel(sourcePixels, 2, 1, 1),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 0, 2)).toEqual(
      readPixel(sourcePixels, 2, 0, 1),
    );
    // Bottom row of raster = own-half col (srcCol=0).
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 1, 0)).toEqual(
      readPixel(sourcePixels, 2, 2, 0),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 1, 1)).toEqual(
      readPixel(sourcePixels, 2, 1, 0),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 1, 2)).toEqual(
      readPixel(sourcePixels, 2, 0, 0),
    );
  });

  it("transposes vertical rasters so pitch x becomes the image vertical axis (down)", () => {
    // "down" projection: camposX=100 → svg bottom, camposY=0 → svg left.
    // ⇒ raster top-left = camposX=0 (own goal) & camposY=0 (attacker right)
    //                   = source (srcRow=0, srcCol=0).
    const model = makeModel({
      attackingDirection: "down",
      gridWidth: 2,
      gridHeight: 3,
      grid: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    });

    const raster = buildKDERasterData(model, [...stops]);

    expect(raster?.width).toBe(3);
    expect(raster?.height).toBe(2);
    const sourcePixels = kdeGridToRGBA(model, [...stops]);
    // Top row = own-half col (srcCol=0), iterating Y left→right.
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 0, 0)).toEqual(
      readPixel(sourcePixels, 2, 0, 0),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 0, 2)).toEqual(
      readPixel(sourcePixels, 2, 2, 0),
    );
    // Bottom row = opp-half col (srcCol=1).
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 1, 0)).toEqual(
      readPixel(sourcePixels, 2, 0, 1),
    );
    expect(readPixel(raster?.pixels ?? new Uint8ClampedArray(), 3, 1, 2)).toEqual(
      readPixel(sourcePixels, 2, 2, 1),
    );
  });

  it("falls back to a pure PNG data URL when no document is available", () => {
    const model = makeModel({
      attackingDirection: "right",
      gridWidth: 2,
      gridHeight: 1,
      grid: [0.25, 1],
    });

    const dataUrl = densityToDataURL(model, [...stops], 1, null);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
