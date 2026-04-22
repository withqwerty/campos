import { describe, expect, it } from "vitest";

import {
  approxLabelWidth,
  circleIntersectsRect,
  rectsOverlap,
} from "../../src/compute/label-geometry";

describe("label geometry helpers", () => {
  it("caps approximate label width to a readable range", () => {
    expect(approxLabelWidth("A")).toBeGreaterThanOrEqual(22);
    expect(approxLabelWidth("Very long label that should be capped")).toBeLessThanOrEqual(
      120,
    );
  });

  it("detects overlapping rectangles", () => {
    expect(
      rectsOverlap(
        { left: 0, right: 20, top: 0, bottom: 10 },
        { left: 10, right: 30, top: 5, bottom: 15 },
      ),
    ).toBe(true);

    expect(
      rectsOverlap(
        { left: 0, right: 10, top: 0, bottom: 10 },
        { left: 20, right: 30, top: 20, bottom: 30 },
      ),
    ).toBe(false);
  });

  it("detects when a marker circle intersects a label rectangle", () => {
    expect(
      circleIntersectsRect(
        { cx: 10, cy: 10, r: 4 },
        { left: 12, right: 20, top: 8, bottom: 16 },
      ),
    ).toBe(true);

    expect(
      circleIntersectsRect(
        { cx: 0, cy: 0, r: 2 },
        { left: 10, right: 20, top: 10, bottom: 20 },
      ),
    ).toBe(false);
  });
});
