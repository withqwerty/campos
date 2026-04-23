import { describe, expect, it } from "vitest";

import {
  InvalidEdgesError,
  assignBin,
  uniformEdges,
  validateEdges,
} from "../../src/compute/edges";

describe("uniformEdges", () => {
  it("returns count + 1 entries", () => {
    expect(uniformEdges(3, 0, 100)).toHaveLength(4);
    expect(uniformEdges(5, 0, 100)).toHaveLength(6);
    expect(uniformEdges(1, 0, 100)).toHaveLength(2);
  });

  it("snaps the last entry exactly to max (no floating-point drift)", () => {
    const edges = uniformEdges(3, 0, 100);
    expect(edges[0]).toBe(0);
    expect(edges[edges.length - 1]).toBe(100);
  });

  it("distributes interior edges at uniform multiples of (max-min)/count", () => {
    const edges = uniformEdges(3, 0, 100);
    expect(edges[1]).toBeCloseTo(100 / 3, 10);
    expect(edges[2]).toBeCloseTo(200 / 3, 10);
  });

  it("supports non-zero min and arbitrary ranges", () => {
    const edges = uniformEdges(4, 50, 100);
    expect(edges).toHaveLength(5);
    expect(edges[0]).toBe(50);
    expect(edges[4]).toBe(100);
    expect(edges[2]).toBeCloseTo(75, 10);
  });
});

describe("validateEdges", () => {
  it("accepts valid strictly-increasing edges anchored to the expected range", () => {
    expect(() => {
      validateEdges([0, 33, 66, 100], 0, 100, "x");
    }).not.toThrow();
    expect(() => {
      validateEdges([0, 50, 100], 0, 100, "y");
    }).not.toThrow();
  });

  it("throws InvalidEdgesError for fewer than 2 entries", () => {
    expect(() => {
      validateEdges([0], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
    expect(() => {
      validateEdges([], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
  });

  it("throws when any entry is non-finite", () => {
    expect(() => {
      validateEdges([0, Number.NaN, 100], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
    expect(() => {
      validateEdges([0, Number.POSITIVE_INFINITY, 100], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
  });

  it("throws when any entry is outside [0, 100]", () => {
    expect(() => {
      validateEdges([-1, 50, 100], -1, 100, "x");
    }).toThrow(InvalidEdgesError);
    expect(() => {
      validateEdges([0, 50, 101], 0, 101, "x");
    }).toThrow(InvalidEdgesError);
  });

  it("throws when edges are non-monotonic (equal or decreasing)", () => {
    expect(() => {
      validateEdges([0, 50, 50, 100], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
    expect(() => {
      validateEdges([0, 60, 50, 100], 0, 100, "x");
    }).toThrow(InvalidEdgesError);
  });

  it("throws when the first edge does not match the crop's expected start", () => {
    expect(() => {
      validateEdges([5, 50, 100], 0, 100, "x");
    }).toThrow(/must equal 0 for the active crop/);
  });

  it("throws when the last edge does not match the crop's expected end", () => {
    expect(() => {
      validateEdges([0, 50, 95], 0, 100, "x");
    }).toThrow(/must equal 100 for the active crop/);
  });

  it("embeds the axis name in error messages", () => {
    expect(() => {
      validateEdges([0], 0, 100, "x");
    }).toThrow(/x/);
    expect(() => {
      validateEdges([0], 0, 100, "y");
    }).toThrow(/y/);
  });
});

describe("assignBin", () => {
  const edges = [0, 33, 66, 100];

  it("places a value inside the first bin with the half-open rule", () => {
    expect(assignBin(0, edges)).toBe(0);
    expect(assignBin(25, edges)).toBe(0);
  });

  it("transitions to the next bin at the edge boundary", () => {
    expect(assignBin(33, edges)).toBe(1);
    expect(assignBin(65.999, edges)).toBe(1);
  });

  it("maps the final edge to the last bin", () => {
    expect(assignBin(100, edges)).toBe(2);
  });

  it("returns -1 for values strictly below the first edge", () => {
    expect(assignBin(-1, edges)).toBe(-1);
  });

  it("maps values above the last edge to the last bin", () => {
    // The implementation's early return treats `value >= edges[last]` as the
    // last bin — this handles FP drift at the upper boundary.
    expect(assignBin(150, edges)).toBe(2);
  });
});

describe("InvalidEdgesError", () => {
  it("has the expected name for catch-site narrowing", () => {
    try {
      validateEdges([0], 0, 100, "x");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEdgesError);
      expect((err as InvalidEdgesError).name).toBe("InvalidEdgesError");
    }
  });
});
