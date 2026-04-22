import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { MarginalDensity } from "../../src/primitives/MarginalDensity";

// Spread across the domain — gives a multi-modal ridge.
const SPARSE = [10, 30, 50, 70, 90];
// Tightly clustered at 30 — gives a clear unimodal peak for position tests.
const CLUSTERED = Array.from({ length: 40 }, () => 30);

// ---------------------------------------------------------------------------
// Path-parsing helpers
// ---------------------------------------------------------------------------

/** Extract the ridge points from a path string (all points except the last two
 * L commands, which close the baseline). */
function ridgePoints(d: string): Array<[number, number]> {
  const mMatch = /^M([\d.]+),([\d.]+)/.exec(d);
  const lMatches = [...d.matchAll(/L([\d.]+),([\d.]+)/g)];
  const ridgeLs = lMatches.slice(0, -2);
  const result: Array<[number, number]> = [];
  if (mMatch) result.push([+mMatch[1]!, +mMatch[2]!]);
  for (const m of ridgeLs) result.push([+m[1]!, +m[2]!]);
  return result;
}

/** Return the x-coordinate of the density peak (minimum y = highest density for flip=false). */
function peakX(d: string): number {
  const pts = ridgePoints(d);
  const minY = Math.min(...pts.map((p) => p[1]));
  const peakPts = pts.filter((p) => p[1] <= minY + 0.5);
  return peakPts.reduce((s, p) => s + p[0], 0) / peakPts.length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarginalDensity", () => {
  // --- Empty / degenerate input ---

  it("renders no path and a valid svg when values is empty", () => {
    const { container } = render(
      <MarginalDensity values={[]} orientation="horizontal" width={200} height={40} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders no path when all values are non-finite", () => {
    const { container } = render(
      <MarginalDensity
        values={[NaN, Infinity, -Infinity]}
        orientation="horizontal"
        width={200}
        height={40}
      />,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders no path when all values fall outside the domain", () => {
    const { container } = render(
      <MarginalDensity
        values={[-20, 110]}
        orientation="horizontal"
        width={200}
        height={40}
        domain={[0, 100]}
      />,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders no path when width is zero", () => {
    const { container } = render(
      <MarginalDensity values={SPARSE} orientation="horizontal" width={0} height={40} />,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  it("renders no path when height is zero", () => {
    const { container } = render(
      <MarginalDensity values={SPARSE} orientation="horizontal" width={200} height={0} />,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  // --- Orientation ---

  it("renders a path for horizontal orientation", () => {
    const { container } = render(
      <MarginalDensity
        values={SPARSE}
        orientation="horizontal"
        width={200}
        height={40}
      />,
    );
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("renders a path for vertical orientation", () => {
    const { container } = render(
      <MarginalDensity values={SPARSE} orientation="vertical" width={40} height={200} />,
    );
    expect(container.querySelector("path")).not.toBeNull();
  });

  // --- Style props ---

  it("applies fill and stroke to the path", () => {
    const { container } = render(
      <MarginalDensity
        values={SPARSE}
        orientation="horizontal"
        width={200}
        height={40}
        fill="#ff0000"
        stroke="#00ff00"
        strokeWidth={3}
      />,
    );
    const path = container.querySelector("path");
    expect(path?.getAttribute("fill")).toBe("#ff0000");
    expect(path?.getAttribute("stroke")).toBe("#00ff00");
    expect(path?.getAttribute("stroke-width")).toBe("3");
  });

  it("applies opacity to the svg wrapper when supplied", () => {
    const { container } = render(
      <MarginalDensity
        values={SPARSE}
        orientation="horizontal"
        width={200}
        height={40}
        opacity={0.6}
      />,
    );
    expect(container.querySelector("svg")?.getAttribute("opacity")).toBe("0.6");
  });

  // --- Accessibility ---

  it("sets aria-label on the svg when ariaLabel is provided", () => {
    const { container } = render(
      <MarginalDensity
        values={SPARSE}
        orientation="horizontal"
        width={200}
        height={40}
        ariaLabel="x-distribution of defensive actions"
      />,
    );
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "x-distribution of defensive actions",
    );
  });

  // --- flip: baseline position ---

  it("flip=false positions the horizontal baseline at the bottom edge", () => {
    const { container } = render(
      <MarginalDensity
        values={CLUSTERED}
        orientation="horizontal"
        width={200}
        height={40}
        flip={false}
      />,
    );
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    // Last two L commands close the path back to the baseline at y = height.
    const lMatches = [...d.matchAll(/L([\d.]+),([\d.]+)/g)];
    const lastTwo = lMatches.slice(-2);
    for (const m of lastTwo) {
      expect(Number.parseFloat(m[2]!)).toBeCloseTo(40, 0);
    }
  });

  it("flip=true positions the horizontal baseline at the top edge (y ≈ 0)", () => {
    const { container } = render(
      <MarginalDensity
        values={CLUSTERED}
        orientation="horizontal"
        width={200}
        height={40}
        flip={true}
      />,
    );
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    const lMatches = [...d.matchAll(/L([\d.]+),([\d.]+)/g)];
    const lastTwo = lMatches.slice(-2);
    for (const m of lastTwo) {
      expect(Number.parseFloat(m[2]!)).toBeCloseTo(0, 0);
    }
  });

  // --- reverse: domain inversion ---

  it("peak appears in the left half when values cluster at 30 (no reverse)", () => {
    // Domain [0, 100], width=200. Value 30 maps to x ≈ 60 (left half of 200).
    const { container } = render(
      <MarginalDensity
        values={CLUSTERED}
        orientation="horizontal"
        width={200}
        height={40}
        flip={false}
      />,
    );
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    const px = peakX(d);
    expect(px).toBeGreaterThan(20);
    expect(px).toBeLessThan(100);
  });

  it("reverse=true shifts the peak to the right half for the same left-clustered values", () => {
    // Same data, domain inverted: value 30 maps to x ≈ 140 (right half of 200).
    const { container } = render(
      <MarginalDensity
        values={CLUSTERED}
        orientation="horizontal"
        width={200}
        height={40}
        flip={false}
        reverse={true}
      />,
    );
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(peakX(d)).toBeGreaterThan(100);
  });
});
