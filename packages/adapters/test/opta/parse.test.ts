import { describe, expect, it } from "vitest";

import { fromOpta } from "../../src/opta/index.js";
import { parseWhoScored } from "../../src/whoscored/parse.js";
import type { MatchContext } from "@withqwerty/campos-schema";

import wsFixture from "../fixtures/opta/whoscored-match-centre-data.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ctx: MatchContext = {
  matchId: wsFixture.matchId,
  homeTeamId: wsFixture.home.teamId,
  awayTeamId: wsFixture.away.teamId,
  periods: {
    firstHalf: { homeAttacksToward: "decreasing-x" },
    secondHalf: { homeAttacksToward: "increasing-x" },
  },
};

const parsed = parseWhoScored(wsFixture.events);

// ---------------------------------------------------------------------------
// 1. Parse WhoScored events into OptaEvent shape
// ---------------------------------------------------------------------------

describe("parseWhoScored — structural shape", () => {
  it("returns the same number of events as the fixture", () => {
    expect(parsed).toHaveLength(wsFixture.events.length);
  });

  it("every parsed event has correct field types", () => {
    for (const event of parsed) {
      expect(typeof event.id).toBe("number");
      expect(typeof event.eventId).toBe("number");
      expect(typeof event.typeId).toBe("number");
      expect(typeof event.periodId).toBe("number");
      expect(typeof event.timeMin).toBe("number");
      expect(typeof event.timeSec).toBe("number");
      expect(typeof event.contestantId).toBe("string");
      expect(typeof event.outcome).toBe("number");
      expect(typeof event.x).toBe("number");
      expect(typeof event.y).toBe("number");
      expect(Array.isArray(event.qualifier)).toBe(true);
    }
  });

  it("maps typeId from nested type.value", () => {
    // First event in fixture has type.value = 1 (pass)
    const first = parsed[0] as (typeof parsed)[0];
    expect(first.typeId).toBe(
      (wsFixture.events[0] as (typeof wsFixture.events)[0]).type.value,
    );
  });

  it("maps periodId from nested period.value", () => {
    const first = parsed[0] as (typeof parsed)[0];
    expect(first.periodId).toBe(
      (wsFixture.events[0] as (typeof wsFixture.events)[0]).period.value,
    );
  });

  it("maps outcome from nested outcomeType.value", () => {
    const first = parsed[0] as (typeof parsed)[0];
    expect(first.outcome).toBe(
      (wsFixture.events[0] as (typeof wsFixture.events)[0]).outcomeType.value,
    );
  });

  it("converts teamId to string contestantId", () => {
    for (const event of parsed) {
      expect(typeof event.contestantId).toBe("string");
      expect(event.contestantId.length).toBeGreaterThan(0);
    }
  });

  it("converts playerId to string when present", () => {
    const withPlayer = parsed.filter((e) => e.playerId != null);
    expect(withPlayer.length).toBeGreaterThan(0);
    for (const event of withPlayer) {
      expect(typeof event.playerId).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Parsed events normalize through fromOpta.events()
// ---------------------------------------------------------------------------

describe("parseWhoScored → fromOpta.events() pipeline", () => {
  const normalized = fromOpta.events(parsed, ctx);

  it("produces normalized events from WhoScored input", () => {
    expect(normalized.length).toBeGreaterThan(0);
  });

  it("every normalized event has provider 'opta'", () => {
    for (const event of normalized) {
      expect(event.provider).toBe("opta");
    }
  });

  it("every normalized event has a recognized kind", () => {
    const validKinds = new Set([
      "shot",
      "pass",
      "tackle",
      "foul",
      "card",
      "interception",
      "clearance",
      "duel",
      "goalkeeper",
      "substitution",
    ]);
    for (const event of normalized) {
      expect(validKinds.has(event.kind)).toBe(true);
    }
  });

  it("produces pass events from typeId=1 events", () => {
    const passes = normalized.filter((e) => e.kind === "pass");
    const passInputs = parsed.filter((e) => e.typeId === 1);
    expect(passes).toHaveLength(passInputs.length);
  });

  it("produces shot events from shot typeIds", () => {
    const shots = normalized.filter((e) => e.kind === "shot");
    const shotInputs = parsed.filter((e) => [13, 14, 15, 16].includes(e.typeId));
    expect(shots).toHaveLength(shotInputs.length);
  });

  it("normalized events carry matchId from context", () => {
    for (const event of normalized) {
      expect(event.matchId).toBe(ctx.matchId);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Qualifier IDs survive translation
// ---------------------------------------------------------------------------

describe("parseWhoScored — qualifier preservation", () => {
  it("qualifier arrays have qualifierId and value fields", () => {
    const withQualifiers = parsed.filter((e) => e.qualifier && e.qualifier.length > 0);
    expect(withQualifiers.length).toBeGreaterThan(0);

    for (const event of withQualifiers) {
      for (const q of event.qualifier as NonNullable<typeof event.qualifier>) {
        expect(typeof q.qualifierId).toBe("number");
        // value is string | null | undefined
        expect(
          q.value === null || q.value === undefined || typeof q.value === "string",
        ).toBe(true);
      }
    }
  });

  it("body-part qualifier 72 (left foot) survives parsing", () => {
    // Fixture events with qualifier 72: eventId 75 (shot) and eventId 280
    const withLeftFoot = parsed.filter((e) =>
      e.qualifier?.some((q) => q.qualifierId === 72),
    );
    expect(withLeftFoot.length).toBeGreaterThan(0);
  });

  it("body-part qualifier 15 (head) survives parsing", () => {
    // Fixture event 138 has qualifier 15
    const withHead = parsed.filter((e) => e.qualifier?.some((q) => q.qualifierId === 15));
    expect(withHead.length).toBeGreaterThan(0);
  });

  it("body-part qualifier 20 (right foot) survives parsing", () => {
    // Fixture event 203 has qualifier 20
    const withRightFoot = parsed.filter((e) =>
      e.qualifier?.some((q) => q.qualifierId === 20),
    );
    expect(withRightFoot.length).toBeGreaterThan(0);
  });

  it("qualifiers without a value get null", () => {
    // Many qualifiers in the fixture omit value (e.g. type 278, 155, 154)
    const nullValueQualifiers = parsed.flatMap(
      (e) => e.qualifier?.filter((q) => q.value === null) ?? [],
    );
    expect(nullValueQualifiers.length).toBeGreaterThan(0);
  });

  it("qualifiers with a value preserve the string", () => {
    // e.g. qualifier 56 with value "Center"
    const zone56 = parsed.flatMap(
      (e) => e.qualifier?.filter((q) => q.qualifierId === 56 && q.value != null) ?? [],
    );
    expect(zone56.length).toBeGreaterThan(0);
    expect((zone56[0] as (typeof zone56)[0]).value).toBe("Center");
  });
});
