import { describe, expect, it } from "vitest";

import { normalizeStatsBombClock } from "../../src/statsbomb/clock.js";
import type { StatsBombEvent } from "../../src/statsbomb/parse.js";

import argentinaVsFranceExtraTime from "../fixtures/statsbomb-raw-extra-time-argentina-vs-france.json";

function buildEvent(
  overrides: Partial<Pick<StatsBombEvent, "period" | "minute" | "second">> = {},
): Pick<StatsBombEvent, "period" | "minute" | "second"> {
  return {
    period: 1,
    minute: 10,
    second: 5,
    ...overrides,
  };
}

const extraTimeShot = argentinaVsFranceExtraTime.event[0] as StatsBombEvent;

describe("normalizeStatsBombClock", () => {
  it("does not emit synthetic +0 at a regulation boundary", () => {
    expect(
      normalizeStatsBombClock(buildEvent({ period: 1, minute: 45, second: 0 })),
    ).toEqual({
      minute: 45,
      addedMinute: null,
      second: 0,
    });
  });

  it("splits stoppage time but keeps regular extra-time minutes untouched", () => {
    expect(
      normalizeStatsBombClock(buildEvent({ period: 1, minute: 47, second: 18 })),
    ).toEqual({
      minute: 45,
      addedMinute: 2,
      second: 18,
    });
    expect(
      normalizeStatsBombClock(buildEvent({ period: 4, minute: 121, second: 3 })),
    ).toEqual({
      minute: 120,
      addedMinute: 1,
      second: 3,
    });
  });

  it("preserves a real StatsBomb extra-time event minute from the fixture", () => {
    expect(normalizeStatsBombClock(extraTimeShot)).toEqual({
      minute: 92,
      addedMinute: null,
      second: 5,
    });
  });
});
