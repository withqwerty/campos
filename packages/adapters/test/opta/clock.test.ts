import { describe, expect, it } from "vitest";

import { normalizeOptaClock } from "../../src/opta/clock.js";
import type { OptaEvent } from "../../src/opta/qualifiers.js";

import rawMatchEventsSample from "../fixtures/opta/raw-match-events-sample.json";

function buildEvent(
  overrides: Partial<Pick<OptaEvent, "periodId" | "timeMin" | "timeSec">> = {},
): Pick<OptaEvent, "periodId" | "timeMin" | "timeSec"> {
  return {
    periodId: 1,
    timeMin: 10,
    timeSec: 5,
    ...overrides,
  };
}

const sampleEvent = rawMatchEventsSample.liveData.event[6] as OptaEvent;

describe("normalizeOptaClock", () => {
  it("does not emit synthetic +0 at a regulation boundary", () => {
    expect(
      normalizeOptaClock(buildEvent({ periodId: 1, timeMin: 45, timeSec: 0 })),
    ).toEqual({
      minute: 45,
      addedMinute: null,
      second: 0,
    });
  });

  it("splits stoppage and extra-time boundaries", () => {
    expect(
      normalizeOptaClock(buildEvent({ periodId: 2, timeMin: 93, timeSec: 12 })),
    ).toEqual({
      minute: 90,
      addedMinute: 3,
      second: 12,
    });
    expect(
      normalizeOptaClock(buildEvent({ periodId: 3, timeMin: 108, timeSec: 9 })),
    ).toEqual({
      minute: 105,
      addedMinute: 3,
      second: 9,
    });
  });

  it("preserves ordinary fixture minutes from the raw Opta sample", () => {
    expect(normalizeOptaClock(sampleEvent)).toEqual({
      minute: 55,
      addedMinute: null,
      second: 22,
    });
  });
});
