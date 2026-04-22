import { describe, expect, it } from "vitest";

import { formatNumericTick } from "../../../src/compute/scales/format-number";

describe("formatNumericTick", () => {
  it("formats integers without decimals", () => {
    expect(formatNumericTick(12)).toBe("12");
    expect(formatNumericTick(-7)).toBe("-7");
  });

  it("rounds decimal values to stable significant precision", () => {
    expect(formatNumericTick(1.23456789)).toBe("1.23457");
    expect(formatNumericTick(0.000123456789)).toBe("0.000123457");
  });

  it("trims trailing zeros after formatting", () => {
    expect(formatNumericTick(1.5)).toBe("1.5");
    expect(formatNumericTick(12.3400001)).toBe("12.34");
  });

  it("normalizes negative zero to plain zero", () => {
    expect(formatNumericTick(-0)).toBe("0");
    expect(formatNumericTick(-1e-13)).toBe("0");
  });

  it("uses an ASCII minus sign for negative values", () => {
    expect(formatNumericTick(-0.25)).toBe("-0.25");
  });
});
