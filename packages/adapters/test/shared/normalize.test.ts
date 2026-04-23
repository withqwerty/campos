import { describe, expect, it } from "vitest";

import { validatePeriod } from "../../src/shared/normalize";

describe("validatePeriod", () => {
  it("passes through every supported football period (1 through 5)", () => {
    expect(validatePeriod(1, "opta")).toBe(1);
    expect(validatePeriod(2, "opta")).toBe(2);
    expect(validatePeriod(3, "opta")).toBe(3);
    expect(validatePeriod(4, "opta")).toBe(4);
    expect(validatePeriod(5, "opta")).toBe(5);
  });

  it("throws with the provider name embedded in the message", () => {
    expect(() => validatePeriod(0, "opta")).toThrow(/opta/);
    expect(() => validatePeriod(6, "statsbomb")).toThrow(/statsbomb/);
    expect(() => validatePeriod(-1, "whoscored")).toThrow(/whoscored/);
  });

  it("throws on non-integer period values", () => {
    expect(() => validatePeriod(2.5, "opta")).toThrow();
    expect(() => validatePeriod(1.1, "opta")).toThrow();
  });

  it("throws on non-finite period values", () => {
    expect(() => validatePeriod(Number.NaN, "opta")).toThrow();
    expect(() => validatePeriod(Number.POSITIVE_INFINITY, "opta")).toThrow();
    expect(() => validatePeriod(Number.NEGATIVE_INFINITY, "opta")).toThrow();
  });

  it("includes the offending value in the thrown message", () => {
    expect(() => validatePeriod(7, "opta")).toThrow(/7/);
    expect(() => validatePeriod(2.5, "opta")).toThrow(/2\.5/);
  });
});
