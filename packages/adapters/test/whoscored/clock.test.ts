import { describe, expect, it } from "vitest";

import { normalizeWhoScoredClock } from "../../src/whoscored/clock.js";
import { toOptaEvent, type WhoScoredEvent } from "../../src/whoscored/parse.js";

import sportingVsArsenal from "../fixtures/opta/whoscored-sporting-v-arsenal.json";

function toClockInput(event: WhoScoredEvent) {
  return toOptaEvent(event, sportingVsArsenal.playerIdNameDictionary);
}

const firstAddedMinute = sportingVsArsenal.events.find(
  (event) => event.id === 2921065825,
) as WhoScoredEvent;

describe("normalizeWhoScoredClock", () => {
  it("splits stoppage time from expandedMinute", () => {
    expect(normalizeWhoScoredClock(toClockInput(firstAddedMinute))).toEqual({
      minute: 90,
      addedMinute: 1,
      second: 1,
    });
  });

  it("does not emit synthetic +0 at the regulation boundary", () => {
    expect(
      normalizeWhoScoredClock({
        periodId: 2,
        timeMin: 90,
        timeSec: 0,
      }),
    ).toEqual({
      minute: 90,
      addedMinute: null,
      second: 0,
    });
  });

  it("handles extra-time boundaries using the provider-local clock seam", () => {
    expect(
      normalizeWhoScoredClock({
        periodId: 3,
        timeMin: 107,
        timeSec: 44,
      }),
    ).toEqual({
      minute: 105,
      addedMinute: 2,
      second: 44,
    });
  });
});
