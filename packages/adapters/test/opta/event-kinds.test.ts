import { describe, expect, it } from "vitest";

import { fromOpta } from "../../src/opta/index.js";
import type { MatchContext } from "@withqwerty/campos-schema";
import type { OptaEvent } from "../../src/opta/qualifiers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMatchContext(): MatchContext {
  return {
    matchId: "test-match",
    homeTeamId: "home",
    awayTeamId: "away",
    periods: {
      firstHalf: { homeAttacksToward: "increasing-x" },
      secondHalf: { homeAttacksToward: "decreasing-x" },
    },
  };
}

function buildEvent(overrides: Partial<OptaEvent>): OptaEvent {
  return {
    id: 1,
    eventId: 100,
    typeId: 1,
    periodId: 1,
    timeMin: 10,
    timeSec: 30,
    contestantId: "home",
    playerId: "p1",
    playerName: "Test Player",
    outcome: 1,
    x: 50,
    y: 50,
    qualifier: [],
    ...overrides,
  };
}

function eventsSingle(overrides: Partial<OptaEvent>) {
  const result = fromOpta.events([buildEvent(overrides)], buildMatchContext());
  expect(result).toHaveLength(1);

  return result[0]!;
}

// ---------------------------------------------------------------------------
// Tackle (typeId 4, outcome 1)
// ---------------------------------------------------------------------------

describe("opta tackle events", () => {
  it("maps typeId 4 with outcome=1 to kind=tackle", () => {
    const e = eventsSingle({ typeId: 4, outcome: 1 });
    expect(e.kind).toBe("tackle");
    expect(e.id).toBe("test-match:1");
    expect(e.matchId).toBe("test-match");
    expect(e.provider).toBe("opta");
    expect(e.teamId).toBe("home");
    expect(e.playerId).toBe("p1");
    expect(e.playerName).toBe("Test Player");

    if (e.kind === "tackle") {
      expect(e.tackleOutcome).toBe("won");
      expect(e.x).toBeTypeOf("number");
      expect(e.y).toBeTypeOf("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Foul (typeId 4, outcome 0)
// ---------------------------------------------------------------------------

describe("opta foul events", () => {
  it("maps typeId 4 with outcome=0 to kind=foul-committed", () => {
    const e = eventsSingle({ typeId: 4, outcome: 0 });
    expect(e.kind).toBe("foul-committed");
    expect(e.id).toBe("test-match:1");
    expect(e.matchId).toBe("test-match");
    expect(e.provider).toBe("opta");
    expect(e.teamId).toBe("home");

    if (e.kind === "foul-committed") {
      expect(e.x).toBeTypeOf("number");
      expect(e.y).toBeTypeOf("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Cards (typeIds 17, 65, 68)
// ---------------------------------------------------------------------------

describe("opta card events", () => {
  it("maps typeId 17 to kind=card with cardType=yellow", () => {
    const e = eventsSingle({ typeId: 17 });
    expect(e.kind).toBe("card");
    expect(e.provider).toBe("opta");

    if (e.kind === "card") {
      expect(e.cardType).toBe("yellow");
      expect(e.x).toBeNull();
      expect(e.y).toBeNull();
    }
  });

  it("maps typeId 65 to kind=card with cardType=second-yellow", () => {
    const e = eventsSingle({ typeId: 65 });
    expect(e.kind).toBe("card");
    if (e.kind === "card") {
      expect(e.cardType).toBe("second-yellow");
    }
  });

  it("maps typeId 68 to kind=card with cardType=red", () => {
    const e = eventsSingle({ typeId: 68 });
    expect(e.kind).toBe("card");
    if (e.kind === "card") {
      expect(e.cardType).toBe("red");
    }
  });
});

// ---------------------------------------------------------------------------
// Interception (typeId 74)
// ---------------------------------------------------------------------------

describe("opta interception events", () => {
  it("maps typeId 74 to kind=interception", () => {
    const e = eventsSingle({ typeId: 74 });
    expect(e.kind).toBe("interception");
    expect(e.provider).toBe("opta");
    expect(e.matchId).toBe("test-match");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// Clearance (typeId 12)
// ---------------------------------------------------------------------------

describe("opta clearance events", () => {
  it("maps typeId 12 to kind=clearance", () => {
    const e = eventsSingle({ typeId: 12 });
    expect(e.kind).toBe("clearance");
    expect(e.provider).toBe("opta");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// Duel / aerial (typeId 44)
// ---------------------------------------------------------------------------

describe("opta duel events", () => {
  it("maps typeId 44 to kind=duel with duelType=aerial", () => {
    const e = eventsSingle({ typeId: 44, outcome: 1 });
    expect(e.kind).toBe("duel");
    expect(e.provider).toBe("opta");

    if (e.kind === "duel") {
      expect(e.duelType).toBe("aerial");
      expect(e.duelOutcome).toBe("won");
    }
  });
});

// ---------------------------------------------------------------------------
// Goalkeeper (typeId 10 = save)
// ---------------------------------------------------------------------------

describe("opta goalkeeper events", () => {
  it("maps typeId 10 to kind=goalkeeper with actionType=save", () => {
    const e = eventsSingle({ typeId: 10 });
    expect(e.kind).toBe("goalkeeper");
    expect(e.provider).toBe("opta");

    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("save");
      expect(e.x).toBeTypeOf("number");
      expect(e.y).toBeTypeOf("number");
    }
  });

  it("maps typeId 11 to kind=goalkeeper with actionType=claim", () => {
    const e = eventsSingle({ typeId: 11 });
    expect(e.kind).toBe("goalkeeper");
    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("claim");
    }
  });

  it("maps typeId 41 to kind=goalkeeper with actionType=punch", () => {
    const e = eventsSingle({ typeId: 41 });
    expect(e.kind).toBe("goalkeeper");
    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("punch");
    }
  });

  it("maps typeId 52 to kind=goalkeeper with actionType=keeper-pick-up", () => {
    const e = eventsSingle({ typeId: 52 });
    expect(e.kind).toBe("goalkeeper");
    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("keeper-pick-up");
    }
  });

  it("maps typeId 59 to kind=goalkeeper", () => {
    const e = eventsSingle({ typeId: 59 });
    expect(e.kind).toBe("goalkeeper");
    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("keeper-pick-up");
    }
  });
});

// ---------------------------------------------------------------------------
// Substitution (typeId 18)
// ---------------------------------------------------------------------------

describe("opta substitution events", () => {
  it("maps typeId 18 to kind=substitution with null coordinates", () => {
    const e = eventsSingle({ typeId: 18 });
    expect(e.kind).toBe("substitution");
    expect(e.provider).toBe("opta");

    if (e.kind === "substitution") {
      expect(e.x).toBeNull();
      expect(e.y).toBeNull();
      expect(e.playerInId).toBeNull();
      expect(e.playerInName).toBeNull();
    }
  });

  it("pairs typeId 18 with following typeId 19 to populate playerIn fields", () => {
    const result = fromOpta.events(
      [
        buildEvent({
          id: 18,
          eventId: 466,
          typeId: 18,
          playerId: "player-off",
          playerName: "Outgoing Player",
          x: 0,
          y: 0,
        }),
        buildEvent({
          id: 19,
          eventId: 467,
          typeId: 19,
          playerId: "player-in",
          playerName: "Incoming Player",
          x: 0,
          y: 0,
        }),
      ],
      buildMatchContext(),
    );

    expect(result).toHaveLength(1);
    const e = result[0]!;
    expect(e.kind).toBe("substitution");
    if (e.kind === "substitution") {
      expect(e.playerId).toBe("player-off");
      expect(e.playerName).toBe("Outgoing Player");
      expect(e.playerInId).toBe("player-in");
      expect(e.playerInName).toBe("Incoming Player");
    }
  });

  it("does not emit a standalone substitution for typeId 19", () => {
    const result = fromOpta.events([buildEvent({ typeId: 19 })], buildMatchContext());
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stoppage time
// ---------------------------------------------------------------------------

describe("opta stoppage time normalization", () => {
  it("does not emit synthetic +0 stoppage time at the exact period boundary", () => {
    const e = eventsSingle({ typeId: 74, timeMin: 45, periodId: 1 });
    expect(e.minute).toBe(45);
    expect(e.addedMinute).toBeNull();
  });

  it("splits first-half stoppage time (timeMin 47, periodId 1)", () => {
    const e = eventsSingle({ typeId: 74, timeMin: 47, periodId: 1 });
    expect(e.minute).toBe(45);
    expect(e.addedMinute).toBe(2);
  });

  it("splits second-half stoppage time (timeMin 93, periodId 2)", () => {
    const e = eventsSingle({ typeId: 74, timeMin: 93, periodId: 2 });
    expect(e.minute).toBe(90);
    expect(e.addedMinute).toBe(3);
  });
});
