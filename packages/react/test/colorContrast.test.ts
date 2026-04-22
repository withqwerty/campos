import { describe, expect, it } from "vitest";

import {
  contrastColor,
  contrastRatio,
  hexLuminance,
  parseColorString,
  pickContrast,
  relativeLuminance,
} from "../src/colorContrast.js";

describe("parseColorString", () => {
  it("parses 6-digit hex", () => {
    expect(parseColorString("#ffffff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColorString("#000000")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    const red = parseColorString("#ff0000")!;
    expect(red.r).toBe(1);
    expect(red.g).toBe(0);
    expect(red.b).toBe(0);
  });

  it("parses 3-digit hex (channel doubling)", () => {
    expect(parseColorString("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    const c = parseColorString("#abc")!;
    expect(c.r).toBeCloseTo(0xaa / 255, 6);
    expect(c.g).toBeCloseTo(0xbb / 255, 6);
    expect(c.b).toBeCloseTo(0xcc / 255, 6);
  });

  it("parses 8-digit hex with alpha", () => {
    const c = parseColorString("#ff0000cc")!;
    expect(c.r).toBe(1);
    expect(c.a).toBeCloseTo(0xcc / 255, 6);
  });

  it("parses rgb() and rgba()", () => {
    expect(parseColorString("rgb(255, 0, 0)")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    const c = parseColorString("rgba(0, 0, 0, 0.5)")!;
    expect(c.r).toBe(0);
    expect(c.a).toBe(0.5);
  });

  it("parses CSS Color 4 slash form", () => {
    const c = parseColorString("rgb(255 0 0 / 0.25)")!;
    expect(c.r).toBe(1);
    expect(c.a).toBe(0.25);
  });

  it("parses transparent and rgba(0,0,0,0) consistently", () => {
    expect(parseColorString("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColorString("rgba(0,0,0,0)")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("parses common named colours", () => {
    expect(parseColorString("white")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColorString("black")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    const blue = parseColorString("blue")!;
    expect(blue.b).toBe(1);
  });

  it("returns null on unparseable input", () => {
    expect(parseColorString("not-a-color")).toBeNull();
    expect(parseColorString("")).toBeNull();
    expect(parseColorString("#zz")).toBeNull();
  });

  it("clamps out-of-range channel values", () => {
    const c = parseColorString("rgb(300, -10, 128)")!;
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    expect(c.b).toBeCloseTo(128 / 255, 6);
  });
});

describe("relativeLuminance", () => {
  it("returns 0 for black and 1 for white", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 })).toBe(0);
    expect(relativeLuminance({ r: 1, g: 1, b: 1, a: 1 })).toBeCloseTo(1, 6);
  });

  it("matches the WCAG fixture for mid-grey #777777", () => {
    // Canonical WCAG 2.x value for #777777: ≈ 0.18.
    const c = parseColorString("#777777")!;
    expect(relativeLuminance(c)).toBeCloseTo(0.18, 2);
  });

  it("orders saturated primaries: green > red > blue", () => {
    // WCAG weights: green dominates. Standard pure red/green/blue values:
    // R=0.2126, G=0.7152, B=0.0722.
    const r = relativeLuminance({ r: 1, g: 0, b: 0, a: 1 });
    const g = relativeLuminance({ r: 0, g: 1, b: 0, a: 1 });
    const b = relativeLuminance({ r: 0, g: 0, b: 1, a: 1 });
    expect(r).toBeCloseTo(0.2126, 4);
    expect(g).toBeCloseTo(0.7152, 4);
    expect(b).toBeCloseTo(0.0722, 4);
  });

  it("ignores alpha — luminance is a property of the colour, not the opacity", () => {
    const opaque = relativeLuminance({ r: 1, g: 0, b: 0, a: 1 });
    const transparent = relativeLuminance({ r: 1, g: 0, b: 0, a: 0 });
    expect(opaque).toBe(transparent);
  });
});

describe("contrastRatio", () => {
  it("black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
  });

  it("white on white is 1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 4);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#0f172a", "#fff7ed")).toBeCloseTo(
      contrastRatio("#fff7ed", "#0f172a"),
      6,
    );
  });

  it("returns 1 on unparseable input", () => {
    expect(contrastRatio("oops", "#000")).toBe(1);
    expect(contrastRatio("#000", "oops")).toBe(1);
  });
});

describe("pickContrast", () => {
  const candidates = ["#0f172a", "#ffffff"];

  it("picks white on dark backgrounds", () => {
    expect(pickContrast("#000000", candidates)).toBe("#ffffff");
    expect(pickContrast("#1a1a1a", candidates)).toBe("#ffffff");
    expect(pickContrast("#140e36", candidates)).toBe("#ffffff");
  });

  it("picks dark on light backgrounds", () => {
    expect(pickContrast("#ffffff", candidates)).toBe("#0f172a");
    expect(pickContrast("#fbffa4", candidates)).toBe("#0f172a");
    expect(pickContrast("#fff7ed", candidates)).toBe("#0f172a");
  });

  it("returns the higher-contrast pick for a borderline mid-grey", () => {
    // L(#808080) ≈ 0.215. Ratio against black ≈ 5.30, against white ≈ 3.96 —
    // so dark wins (a tiny bit) for mid-greys via the WCAG formula.
    const got = pickContrast("#808080", candidates);
    expect(got).toBe("#0f172a");
    // And the other direction confirms which is dark vs light:
    expect(pickContrast("#a0a0a0", candidates)).toBe("#0f172a");
    expect(pickContrast("#404040", candidates)).toBe("#ffffff");
  });

  it("respects an n-way candidate list", () => {
    const triple = ["#ff0000", "#ffffff", "#0f172a"];
    // Against deep navy, white should win the contrast battle even though
    // black is in the list.
    expect(pickContrast("#0a1f3d", triple)).toBe("#ffffff");
  });

  it("holdRange returns the hold colour in the borderline band", () => {
    // bg luminance for #808080 is ~0.216 — outside a 0.04 hold band but
    // inside a 0.4 hold band. Use 0.4 just for assertion clarity.
    expect(
      pickContrast("#808080", candidates, {
        holdRange: 0.4,
        holdColor: "#888888",
      }),
    ).toBe("#888888");
  });

  it("falls back to first candidate on unparseable bg", () => {
    expect(pickContrast("not-a-color", candidates)).toBe(candidates[0]);
  });

  it("handles an empty candidate list", () => {
    expect(pickContrast("#fff", [])).toBe("#000000");
  });
});

describe("contrastColor (back-compat)", () => {
  it("matches the previous contract — dark text on light bg, light text on dark bg", () => {
    expect(contrastColor("#ffffff")).toBe("#1a1a1a");
    expect(contrastColor("#000000")).toBe("#ffffff");
  });

  it("respects custom dark/light overrides", () => {
    expect(contrastColor("#ffffff", "#222", "#fff")).toBe("#222");
    expect(contrastColor("#000000", "#222", "#fff")).toBe("#fff");
  });
});

describe("hexLuminance (back-compat)", () => {
  it("returns the same value as relativeLuminance(parseColorString(...))", () => {
    expect(hexLuminance("#777777")).toBeCloseTo(0.18, 2);
    expect(hexLuminance("#000000")).toBe(0);
    expect(hexLuminance("#ffffff")).toBeCloseTo(1, 6);
  });

  it("returns 1 (treated as light) on parse failure", () => {
    expect(hexLuminance("oops")).toBe(1);
  });
});
