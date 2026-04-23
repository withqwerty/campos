import { describe, expect, it } from "vitest";

import {
  BLUES_STOPS,
  COLOR_SCALES,
  GREENS_STOPS,
  INFERNO_STOPS,
  MAGMA_STOPS,
  RDBU_STOPS,
  RDYLGN_STOPS,
  REDS_STOPS,
  VIRIDIS_STOPS,
  resolveColorStops,
} from "../../src/compute/color-scales";

const NAMED_STOPS = {
  magma: MAGMA_STOPS,
  viridis: VIRIDIS_STOPS,
  inferno: INFERNO_STOPS,
  blues: BLUES_STOPS,
  greens: GREENS_STOPS,
  reds: REDS_STOPS,
  rdbu: RDBU_STOPS,
  rdylgn: RDYLGN_STOPS,
};

describe("named colour scale constants", () => {
  it.each(Object.entries(NAMED_STOPS))("%s has exactly 5 stops", (_, stops) => {
    expect(stops).toHaveLength(5);
  });

  it.each(Object.entries(NAMED_STOPS))(
    "%s has monotonic offsets anchored at 0 and 1",
    (_, stops) => {
      expect(stops[0]?.offset).toBe(0);
      expect(stops[stops.length - 1]?.offset).toBe(1);
      for (let i = 1; i < stops.length; i += 1) {
        expect(stops[i]?.offset).toBeGreaterThan(stops[i - 1]?.offset ?? -1);
      }
    },
  );

  it.each(Object.entries(NAMED_STOPS))(
    "%s stores every colour as a 7-character hex string",
    (_, stops) => {
      for (const stop of stops) {
        expect(stop.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    },
  );
});

describe("COLOR_SCALES registry", () => {
  it("exposes the eight canonical keys", () => {
    const expected = [
      "magma",
      "viridis",
      "inferno",
      "blues",
      "greens",
      "reds",
      "sequential-blues",
      "sequential-reds",
      "diverging-rdbu",
      "diverging-rdylgn",
    ];
    for (const key of expected) {
      expect(COLOR_SCALES, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("aliases sequential-blues and sequential-reds to the base scales", () => {
    expect(COLOR_SCALES["sequential-blues"]).toBe(BLUES_STOPS);
    expect(COLOR_SCALES["sequential-reds"]).toBe(REDS_STOPS);
  });
});

describe("resolveColorStops", () => {
  it("resolves a known named scale", () => {
    expect(resolveColorStops("magma", undefined)).toBe(MAGMA_STOPS);
    expect(resolveColorStops("viridis", undefined)).toBe(VIRIDIS_STOPS);
    expect(resolveColorStops("diverging-rdbu", undefined)).toBe(RDBU_STOPS);
  });

  it("returns the custom stops when colorScale is 'custom' and stops are non-empty", () => {
    const custom = [
      { offset: 0, color: "#abcdef" },
      { offset: 1, color: "#123456" },
    ];
    expect(resolveColorStops("custom", custom)).toBe(custom);
  });

  it("falls back to magma when 'custom' is requested but stops are empty", () => {
    expect(resolveColorStops("custom", [])).toBe(MAGMA_STOPS);
  });

  it("falls back to magma for an unknown scale name", () => {
    expect(resolveColorStops("unknown-scale", undefined)).toBe(MAGMA_STOPS);
  });

  it("falls back to magma when both arguments are undefined", () => {
    expect(resolveColorStops(undefined, undefined)).toBe(MAGMA_STOPS);
  });

  it("ignores custom stops when the scale name is not 'custom'", () => {
    const custom = [{ offset: 0, color: "#000000" }];
    expect(resolveColorStops("viridis", custom)).toBe(VIRIDIS_STOPS);
  });
});
