import { describe, expect, it } from "vitest";

import {
  extent,
  extentBy,
  max,
  maxBy,
  mean,
  meanBy,
  median,
  min,
  minBy,
  sum,
  sumBy,
} from "../../src/compute/math";

describe("math helpers", () => {
  it("computes scalar reductions with empty-array handling", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(median([1, 3, 5])).toBe(3);
    expect(min([2, 4, 6])).toBe(2);
    expect(max([2, 4, 6])).toBe(6);
    expect(sum([2, 4, 6])).toBe(12);
    expect(extent([2, 4, 6])).toEqual([2, 6]);
  });

  it("returns safe empty values for reductions", () => {
    expect(mean([])).toBe(0);
    expect(median([])).toBe(0);
    expect(min([])).toBeUndefined();
    expect(max([])).toBeUndefined();
    expect(sum([])).toBe(0);
    expect(extent([])).toBeNull();
  });

  it("computes accessor-based reductions", () => {
    const rows = [
      { value: 2, other: 8 },
      { value: 4, other: 6 },
      { value: 6, other: 4 },
    ];

    expect(meanBy(rows, (row) => row.value)).toBe(4);
    expect(minBy(rows, (row) => row.value)).toBe(2);
    expect(maxBy(rows, (row) => row.value)).toBe(6);
    expect(sumBy(rows, (row) => row.other)).toBe(18);
    expect(extentBy(rows, (row) => row.value)).toEqual([2, 6]);
  });

  it("preserves empty semantics for accessor-based min/max/extent", () => {
    const rows: Array<{ value: number }> = [];

    expect(meanBy(rows, (row) => row.value)).toBe(0);
    expect(minBy(rows, (row) => row.value)).toBeUndefined();
    expect(maxBy(rows, (row) => row.value)).toBeUndefined();
    expect(sumBy(rows, (row) => row.value)).toBe(0);
    expect(extentBy(rows, (row) => row.value)).toBeNull();
  });
});
