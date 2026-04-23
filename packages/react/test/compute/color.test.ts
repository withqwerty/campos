import { describe, expect, it } from "vitest";

import { hexToRgb, interpolateStops, rgbToHex } from "../../src/compute/color";

describe("hexToRgb", () => {
  it("decodes pure black", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("decodes pure white", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("decodes primary colour channels", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
  });

  it("is case-insensitive and handles the optional hash prefix", () => {
    expect(hexToRgb("#ABCDEF")).toEqual([171, 205, 239]);
    expect(hexToRgb("ABCDEF")).toEqual([171, 205, 239]);
    expect(hexToRgb("abcdef")).toEqual([171, 205, 239]);
  });
});

describe("rgbToHex", () => {
  it("round-trips primary channels through hex", () => {
    expect(rgbToHex([0, 0, 0])).toBe("#000000");
    expect(rgbToHex([255, 255, 255])).toBe("#ffffff");
    expect(rgbToHex([255, 0, 0])).toBe("#ff0000");
    expect(rgbToHex([0, 255, 0])).toBe("#00ff00");
    expect(rgbToHex([0, 0, 255])).toBe("#0000ff");
  });

  it("rounds non-integer channels before encoding", () => {
    expect(rgbToHex([0.6, 0.4, 0.5])).toBe("#010001");
  });

  it("pads single-digit hex to two characters per channel", () => {
    expect(rgbToHex([1, 2, 3])).toBe("#010203");
  });

  it("round-trips through hexToRgb for a random colour", () => {
    const rgb: [number, number, number] = [171, 205, 239];
    expect(hexToRgb(rgbToHex(rgb))).toEqual(rgb);
  });
});

describe("interpolateStops", () => {
  const twoStops = [
    { offset: 0, color: "#000000" },
    { offset: 1, color: "#ffffff" },
  ];

  it("returns the first stop at t = 0", () => {
    expect(interpolateStops(twoStops, 0)).toBe("#000000");
  });

  it("returns the last stop at t = 1", () => {
    expect(interpolateStops(twoStops, 1)).toBe("#ffffff");
  });

  it("linearly mixes at the midpoint", () => {
    // Midpoint of black → white is (127.5, 127.5, 127.5) rounded to (128, 128, 128)
    expect(interpolateStops(twoStops, 0.5)).toBe("#808080");
  });

  it("clamps t below 0 to the first stop", () => {
    expect(interpolateStops(twoStops, -1)).toBe("#000000");
    expect(interpolateStops(twoStops, -0.0001)).toBe("#000000");
  });

  it("clamps t above 1 to the last stop", () => {
    expect(interpolateStops(twoStops, 2)).toBe("#ffffff");
    expect(interpolateStops(twoStops, 1.0001)).toBe("#ffffff");
  });

  it("falls through to the last stop when t lies past the final segment", () => {
    const shortStops = [{ offset: 0, color: "#123456" }];
    expect(interpolateStops(shortStops, 0.5)).toBe("#123456");
  });

  it("falls back to black when the stops array is empty", () => {
    expect(interpolateStops([], 0.5)).toBe("#000000");
  });

  it("respects non-uniform stop offsets", () => {
    const stops = [
      { offset: 0, color: "#000000" },
      { offset: 0.25, color: "#ffffff" },
      { offset: 1, color: "#ff0000" },
    ];
    // At t=0.125 we sit halfway through the [0, 0.25] segment: black → white.
    expect(interpolateStops(stops, 0.125)).toBe("#808080");
  });
});
