import { describe, expect, it } from "vitest";
import { adjustHexBrightness, resolveGrassColors } from "../../src/react/grass.js";

describe("adjustHexBrightness", () => {
  it("lightens a colour by the given percentage", () => {
    // #000000 lightened by 50% → each channel moves halfway to 255
    const result = adjustHexBrightness("#000000", 50);
    // 0 + (255 - 0) * 0.5 = 127.5 → rounds to 128 = 0x80
    expect(result).toBe("#808080");
  });

  it("darkens a colour by the given percentage", () => {
    // #ffffff darkened by -50% → each channel * 0.5 = 128 → 0x80
    const result = adjustHexBrightness("#ffffff", -50);
    expect(result).toBe("#808080");
  });

  it("returns the same colour at 0%", () => {
    expect(adjustHexBrightness("#1a472a", 0)).toBe("#1a472a");
  });

  it("handles 3-char hex shorthand", () => {
    // #fff → #ffffff
    expect(adjustHexBrightness("#fff", 0)).toBe("#ffffff");
  });

  it("clamps channels to 0–255", () => {
    // Lightening white stays white
    expect(adjustHexBrightness("#ffffff", 50)).toBe("#ffffff");
    // Darkening black stays black
    expect(adjustHexBrightness("#000000", -50)).toBe("#000000");
  });

  it("handles hex without # prefix", () => {
    expect(adjustHexBrightness("1a472a", 0)).toBe("#1a472a");
  });
});

describe("resolveGrassColors", () => {
  const baseFill = "#1a472a";

  it("derives light and dark fills from base when no overrides given", () => {
    const { lightFill, darkFill } = resolveGrassColors(baseFill, { type: "stripes" });
    expect(lightFill).not.toBe(baseFill);
    expect(darkFill).not.toBe(baseFill);
    // Light should be brighter than base
    expect(parseInt(lightFill.slice(1, 3), 16)).toBeGreaterThan(
      parseInt(baseFill.slice(1, 3), 16),
    );
    // Dark should be dimmer than base
    expect(parseInt(darkFill.slice(1, 3), 16)).toBeLessThan(
      parseInt(baseFill.slice(1, 3), 16),
    );
  });

  it("respects explicit lightFill override", () => {
    const { lightFill } = resolveGrassColors(baseFill, {
      type: "stripes",
      lightFill: "#ff0000",
    });
    expect(lightFill).toBe("#ff0000");
  });

  it("respects explicit darkFill override", () => {
    const { darkFill } = resolveGrassColors(baseFill, {
      type: "stripes",
      darkFill: "#00ff00",
    });
    expect(darkFill).toBe("#00ff00");
  });

  it("returns baseFill for both colours on custom pattern type", () => {
    const { lightFill, darkFill } = resolveGrassColors(baseFill, {
      type: "custom",
      id: "test",
      render: () => ({ children: null }),
    });
    expect(lightFill).toBe(baseFill);
    expect(darkFill).toBe(baseFill);
  });

  it("works with all built-in pattern types", () => {
    const types = [
      "stripes",
      "diagonal",
      "chevron",
      "concentric",
      "checkerboard",
    ] as const;
    for (const type of types) {
      const result = resolveGrassColors(baseFill, { type });
      expect(result.lightFill).toBeTruthy();
      expect(result.darkFill).toBeTruthy();
    }
  });

  it("works with formula pattern type", () => {
    const { lightFill, darkFill } = resolveGrassColors(baseFill, {
      type: "formula",
      fn: () => 0,
    });
    expect(lightFill).not.toBe(baseFill);
    expect(darkFill).not.toBe(baseFill);
  });
});
