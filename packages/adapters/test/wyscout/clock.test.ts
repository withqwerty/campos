import { describe, expect, it } from "vitest";

import { normalizeWyscoutClock } from "../../src/wyscout/clock.js";
import type { WyscoutMatchData } from "../../src/wyscout/parse.js";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;
const secondHalfPass = matchData.events.find((event) => event.id === 241084813);

describe("normalizeWyscoutClock", () => {
  it("turns period-local seconds into match-relative minutes", () => {
    expect(normalizeWyscoutClock("2H", 26.700444637425)).toEqual({
      minute: 45,
      addedMinute: null,
      second: 26,
    });
    expect(normalizeWyscoutClock("E2", 17.9)).toEqual({
      minute: 105,
      addedMinute: null,
      second: 17,
    });
  });

  it("preserves a real second-half fixture event", () => {
    expect(secondHalfPass).toBeDefined();
    expect(
      normalizeWyscoutClock(
        secondHalfPass?.matchPeriod ?? "2H",
        secondHalfPass?.eventSec ?? 0,
      ),
    ).toEqual({
      minute: 45,
      addedMinute: null,
      second: 26,
    });
  });
});
