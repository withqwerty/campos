import { describe, expect, it } from "vitest";

import { polarToScreen, roundSvg, wedgePath } from "../../src/compute/wedge-geometry";

describe("roundSvg", () => {
  it("rounds to two decimal places", () => {
    expect(roundSvg(1.23456)).toBe(1.23);
    expect(roundSvg(1.235)).toBe(1.24);
    expect(roundSvg(0.001)).toBe(0);
  });

  it("preserves whole numbers", () => {
    expect(roundSvg(10)).toBe(10);
    expect(roundSvg(0)).toBe(0);
    expect(roundSvg(-42)).toBe(-42);
  });
});

describe("polarToScreen", () => {
  // Canonical frame: +x = toward opposition goal (12 o'clock on screen),
  // +y = attacker's left (9 o'clock on screen).
  it("maps canonical (1, 0) to 12 o'clock (screen y = -r)", () => {
    const { x, y } = polarToScreen(0, 0, 0, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-10, 5);
  });

  it("maps canonical (0, 1) to 9 o'clock (screen x = -r)", () => {
    const { x, y } = polarToScreen(0, 0, Math.PI / 2, 10);
    expect(x).toBeCloseTo(-10, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it("maps canonical (-1, 0) to 6 o'clock (screen y = +r)", () => {
    const { x, y } = polarToScreen(0, 0, Math.PI, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(10, 5);
  });

  it("maps canonical (0, -1) to 3 o'clock (screen x = +r)", () => {
    const { x, y } = polarToScreen(0, 0, -Math.PI / 2, 10);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
  });

  it("applies the centre offset faithfully", () => {
    const { x, y } = polarToScreen(50, 50, 0, 10);
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(40, 5);
  });
});

describe("wedgePath", () => {
  it("returns an empty string when outerR is non-positive", () => {
    expect(wedgePath(0, 0, 0, 0, 0, Math.PI / 2)).toBe("");
    expect(wedgePath(0, 0, 0, -1, 0, Math.PI / 2)).toBe("");
  });

  it("returns an empty string when outerR is not greater than innerR", () => {
    expect(wedgePath(0, 0, 5, 5, 0, Math.PI / 2)).toBe("");
    expect(wedgePath(0, 0, 5, 3, 0, Math.PI / 2)).toBe("");
  });

  it("builds a pie sector path with a centre-point move when innerR is 0", () => {
    const path = wedgePath(100, 100, 0, 10, 0, Math.PI / 2);
    // Pie sector starts at the centre point.
    expect(path.startsWith("M 100 100")).toBe(true);
    expect(path).toContain("A 10 10");
    expect(path.endsWith("Z")).toBe(true);
  });

  it("builds an annular wedge path that does NOT start at the centre", () => {
    const path = wedgePath(100, 100, 5, 10, 0, Math.PI / 2);
    // Annular wedges should not include the centre point.
    expect(path).not.toContain("M 100 100");
    // Contains two arc instructions: one outer radius (10), one inner (5).
    expect(path).toMatch(/A 10 10/);
    expect(path).toMatch(/A 5 5/);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("sets the large-arc-flag when the wedge spans more than π radians", () => {
    // Quarter wedge — arcSweep = 0
    const quarter = wedgePath(0, 0, 0, 10, 0, Math.PI / 2);
    expect(quarter).toMatch(/A 10 10 0 0 1/);

    // Three-quarter wedge — arcSweep = 1 (spans > π)
    const threeQuarter = wedgePath(0, 0, 0, 10, 0, (3 * Math.PI) / 2);
    expect(threeQuarter).toMatch(/A 10 10 0 1 1/);
  });
});
