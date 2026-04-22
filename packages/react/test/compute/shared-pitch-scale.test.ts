import { describe, expect, it } from "vitest";

import { computeSharedPitchScale } from "../../src/compute/shared-pitch-scale";

type Team = {
  xg?: number | null;
  passLengths?: number[];
  widths?: number[];
  pressure?: number[];
};

const teams: Team[] = [
  {
    xg: 0.12,
    passLengths: [8, 16, 22],
    widths: [0.5, 0.8],
    pressure: [3, 7],
  },
  {
    xg: 0.46,
    passLengths: [12, 28],
    widths: [1.2, 1.6],
    pressure: [4],
  },
  {
    xg: null,
    passLengths: [],
    widths: [0.3],
    pressure: [],
  },
];

describe("computeSharedPitchScale", () => {
  it("returns an empty object for null, undefined, and empty input", () => {
    expect(computeSharedPitchScale(null, {})).toEqual({});
    expect(computeSharedPitchScale(undefined, {})).toEqual({});
    expect(computeSharedPitchScale([], {})).toEqual({});
  });

  it("flattens scalar and array outputs into min/max domains", () => {
    const scale = computeSharedPitchScale(teams, {
      size: (team) => team.xg,
      width: (team) => team.passLengths,
      radius: (team) => team.widths,
    });

    expect(scale).toEqual({
      sizeDomain: [0.12, 0.46],
      widthDomain: [8, 28],
      radiusDomain: [0.3, 1.6],
    });
  });

  it("ignores nullish accessors and empty axes", () => {
    const scale = computeSharedPitchScale(teams, {
      size: () => undefined,
      color: () => null,
      width: (team) => team.passLengths,
    });

    expect(scale).toEqual({
      widthDomain: [8, 28],
    });
  });

  it("builds meta channel domains independently", () => {
    const scale = computeSharedPitchScale(teams, {
      meta: {
        pressure: (team) => team.pressure,
        xgBucket: (team) => team.xg,
      },
    });

    expect(scale).toEqual({
      meta: {
        pressure: [3, 7],
        xgBucket: [0.12, 0.46],
      },
    });
  });

  it("throws a descriptive error for non-finite axis values", () => {
    expect(() =>
      computeSharedPitchScale([{ xg: Number.NaN }], {
        size: (team) => team.xg,
      }),
    ).toThrowError(
      '[computeSharedPitchScale] accessor "size" returned a non-finite value for item at index 0.',
    );
  });

  it("throws a descriptive error for non-finite meta values", () => {
    expect(() =>
      computeSharedPitchScale([{ pressure: [Number.POSITIVE_INFINITY] }], {
        meta: {
          pressure: (team) => team.pressure,
        },
      }),
    ).toThrowError(
      '[computeSharedPitchScale] accessor "meta.pressure" returned a non-finite value for item at index 0.',
    );
  });
});
