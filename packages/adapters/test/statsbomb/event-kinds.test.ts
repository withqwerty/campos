import { describe, expect, it } from "vitest";

import { fromStatsBomb } from "../../src/statsbomb/index.js";
import type { StatsBombEvent, StatsBombMatchInfo } from "../../src/statsbomb/parse.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const matchInfo: StatsBombMatchInfo = {
  id: 12345,
  homeTeam: { id: 1, name: "Home" },
  awayTeam: { id: 2, name: "Away" },
};

type EventOverrides = Partial<Omit<StatsBombEvent, "location">> & {
  location?: [number, number] | undefined;
};

function buildEvent(overrides: EventOverrides): StatsBombEvent {
  const base: StatsBombEvent = {
    id: "evt-1",
    index: 1,
    period: 1,
    timestamp: "00:10:30.000",
    minute: 10,
    second: 30,
    type: { id: 1, name: "Unknown" },
    possession: 1,
    possession_team: { id: 1, name: "Home" },
    play_pattern: { id: 1, name: "Regular Play" },
    team: { id: 1, name: "Home" },
    player: { id: 10, name: "Test Player" },
    location: [60, 40],
  };
  const merged = { ...base, ...overrides } as StatsBombEvent;
  if ("location" in overrides && overrides.location === undefined) {
    delete (merged as { location?: [number, number] }).location;
  }
  return merged;
}

function eventsSingle(overrides: EventOverrides) {
  const result = fromStatsBomb.events([buildEvent(overrides)], matchInfo);
  expect(result).toHaveLength(1);

  return result[0]!;
}

// ---------------------------------------------------------------------------
// Carry (type.id 43)
// ---------------------------------------------------------------------------

describe("statsbomb carry events", () => {
  it("maps type.id 43 to kind=carry with endX/endY", () => {
    const e = eventsSingle({
      type: { id: 43, name: "Carry" },
      carry: { end_location: [80, 30] },
    });

    expect(e.kind).toBe("carry");
    expect(e.provider).toBe("statsbomb");
    expect(e.matchId).toBe("12345");
    expect(e.teamId).toBe("1");
    expect(e.playerId).toBe("10");
    expect(e.playerName).toBe("Test Player");

    if (e.kind === "carry") {
      expect(e.x).toBeTypeOf("number");
      expect(e.y).toBeTypeOf("number");
      expect(e.endX).toBeTypeOf("number");
      expect(e.endY).toBeTypeOf("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Tackle (type.id 4, duel.type.name "Tackle")
// ---------------------------------------------------------------------------

describe("statsbomb tackle events", () => {
  it("maps duel type.id 4 with Tackle duel type to kind=tackle", () => {
    const e = eventsSingle({
      type: { id: 4, name: "Duel" },
      duel: {
        type: { id: 1, name: "Tackle" },
        outcome: { id: 1, name: "Won" },
      },
    });

    expect(e.kind).toBe("tackle");
    expect(e.provider).toBe("statsbomb");

    if (e.kind === "tackle") {
      expect(e.tackleOutcome).toBe("won");
    }
  });
});

// ---------------------------------------------------------------------------
// Duel / aerial (type.id 4, duel.type.name "Aerial Lost")
// ---------------------------------------------------------------------------

describe("statsbomb duel events", () => {
  it("maps duel type.id 4 with Aerial Lost to kind=duel, duelType=aerial", () => {
    const e = eventsSingle({
      type: { id: 4, name: "Duel" },
      duel: {
        type: { id: 2, name: "Aerial Lost" },
        outcome: { id: 2, name: "Lost" },
      },
    });

    expect(e.kind).toBe("duel");
    expect(e.provider).toBe("statsbomb");

    if (e.kind === "duel") {
      expect(e.duelType).toBe("aerial");
      expect(e.duelOutcome).toBe("lost");
    }
  });
});

// ---------------------------------------------------------------------------
// Foul + Card (type.id 22 with foul_committed.card)
// ---------------------------------------------------------------------------

describe("statsbomb foul and card events", () => {
  it("maps type.id 22 to kind=foul-committed", () => {
    const e = eventsSingle({
      type: { id: 22, name: "Foul Committed" },
    });
    expect(e.kind).toBe("foul-committed");
    expect(e.provider).toBe("statsbomb");
  });

  it("emits BOTH foul-committed AND card when foul_committed.card exists", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 22, name: "Foul Committed" },
          foul_committed: {
            card: { id: 7, name: "Yellow Card" },
          },
        }),
      ],
      matchInfo,
    );

    expect(events).toHaveLength(2);

    const foul = events[0]!;

    const card = events[1]!;
    expect(foul.kind).toBe("foul-committed");
    expect(card.kind).toBe("card");

    if (card.kind === "card") {
      expect(card.cardType).toBe("yellow");
      expect(card.x).toBeNull();
      expect(card.y).toBeNull();
    }
  });

  it("emits card with cardType=red for Red Card", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 22, name: "Foul Committed" },
          foul_committed: {
            card: { id: 5, name: "Red Card" },
          },
        }),
      ],
      matchInfo,
    );

    expect(events).toHaveLength(2);

    const card = events[1]!;
    if (card.kind === "card") {
      expect(card.cardType).toBe("red");
    }
  });
});

// ---------------------------------------------------------------------------
// Interception (type.id 10)
// ---------------------------------------------------------------------------

describe("statsbomb interception events", () => {
  it("maps type.id 10 to kind=interception", () => {
    const e = eventsSingle({
      type: { id: 10, name: "Interception" },
      interception: { outcome: { id: 1, name: "Won" } },
    });

    expect(e.kind).toBe("interception");
    expect(e.provider).toBe("statsbomb");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// Clearance (type.id 9)
// ---------------------------------------------------------------------------

describe("statsbomb clearance events", () => {
  it("maps type.id 9 to kind=clearance", () => {
    const e = eventsSingle({
      type: { id: 9, name: "Clearance" },
      clearance: { body_part: { id: 40, name: "Right Foot" } },
    });

    expect(e.kind).toBe("clearance");
    expect(e.provider).toBe("statsbomb");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// Goalkeeper (type.id 23)
// ---------------------------------------------------------------------------

describe("statsbomb goalkeeper events", () => {
  it("maps type.id 23 to kind=goalkeeper", () => {
    const e = eventsSingle({
      type: { id: 23, name: "Goal Keeper" },
      goalkeeper: {
        type: { id: 1, name: "Shot Saved" },
      },
    });

    expect(e.kind).toBe("goalkeeper");
    expect(e.provider).toBe("statsbomb");

    if (e.kind === "goalkeeper") {
      expect(e.actionType).toBe("save");
    }
  });
});

// ---------------------------------------------------------------------------
// Substitution (type.id 19)
// ---------------------------------------------------------------------------

describe("statsbomb substitution events", () => {
  it("maps type.id 19 to kind=substitution with null coordinates", () => {
    const e = eventsSingle({
      type: { id: 19, name: "Substitution" },
      substitution: {
        replacement: { id: 99, name: "Sub Player" },
      },
    });

    expect(e.kind).toBe("substitution");
    expect(e.provider).toBe("statsbomb");

    if (e.kind === "substitution") {
      expect(e.x).toBeNull();
      expect(e.y).toBeNull();
      expect(e.playerInId).toBe("99");
      expect(e.playerInName).toBe("Sub Player");
    }
  });
});

// ---------------------------------------------------------------------------
// Ball Recovery (type.id 2)
// ---------------------------------------------------------------------------

describe("statsbomb ball recovery events", () => {
  it("maps type.id 2 to kind=recovery with coordinates", () => {
    const e = eventsSingle({
      type: { id: 2, name: "Ball Recovery" },
    });

    expect(e.kind).toBe("recovery");
    expect(e.provider).toBe("statsbomb");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
  });

  it("drops ball recovery when location missing", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 2, name: "Ball Recovery" },
          location: undefined,
        }),
      ],
      matchInfo,
    );
    expect(events).toHaveLength(0);
  });

  it("threads offensive and recovery_failure flags into sourceMeta", () => {
    const e = eventsSingle({
      type: { id: 2, name: "Ball Recovery" },
      ball_recovery: { offensive: true, recovery_failure: true },
    });

    if (e.kind === "recovery") {
      expect(e.sourceMeta?.offensive).toBe(true);
      expect(e.sourceMeta?.recoveryFailure).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Take-on (type.id 14 Dribble)
// ---------------------------------------------------------------------------

describe("statsbomb take-on events", () => {
  it("maps type.id 14 with Complete outcome to kind=take-on, takeOnResult=complete", () => {
    const e = eventsSingle({
      type: { id: 14, name: "Dribble" },
      dribble: { outcome: { id: 8, name: "Complete" } },
    });

    expect(e.kind).toBe("take-on");
    expect(e.provider).toBe("statsbomb");

    if (e.kind === "take-on") {
      expect(e.takeOnResult).toBe("complete");
      expect(e.x).toBeTypeOf("number");
      expect(e.y).toBeTypeOf("number");
    }
  });

  it("maps Incomplete outcome to takeOnResult=incomplete", () => {
    const e = eventsSingle({
      type: { id: 14, name: "Dribble" },
      dribble: { outcome: { id: 9, name: "Incomplete" } },
    });

    if (e.kind === "take-on") {
      expect(e.takeOnResult).toBe("incomplete");
    }
  });

  it("threads nutmeg, overrun, and no_touch flags into sourceMeta", () => {
    const e = eventsSingle({
      type: { id: 14, name: "Dribble" },
      dribble: {
        outcome: { id: 8, name: "Complete" },
        nutmeg: true,
        overrun: true,
        no_touch: true,
      },
    });

    if (e.kind === "take-on") {
      expect(e.sourceMeta?.nutmeg).toBe(true);
      expect(e.sourceMeta?.overrun).toBe(true);
      expect(e.sourceMeta?.noTouch).toBe(true);
    }
  });

  it("drops dribble when location missing", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 14, name: "Dribble" },
          dribble: { outcome: { id: 8, name: "Complete" } },
          location: undefined,
        }),
      ],
      matchInfo,
    );
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Bad Behaviour card (type.id 24 with bad_behaviour.card)
// ---------------------------------------------------------------------------

describe("statsbomb bad behaviour events", () => {
  it("emits a card when bad_behaviour.card is present (out-of-play booking)", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 24, name: "Bad Behaviour" },
          location: undefined,
          bad_behaviour: { card: { id: 7, name: "Yellow Card" } },
        }),
      ],
      matchInfo,
    );

    expect(events).toHaveLength(1);
    const card = events[0]!;
    expect(card.kind).toBe("card");

    if (card.kind === "card") {
      expect(card.cardType).toBe("yellow");
      expect(card.x).toBeNull();
      expect(card.y).toBeNull();
    }
  });

  it("emits a red card from bad_behaviour.card", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 24, name: "Bad Behaviour" },
          location: undefined,
          bad_behaviour: { card: { id: 5, name: "Red Card" } },
        }),
      ],
      matchInfo,
    );

    const card = events[0]!;
    if (card.kind === "card") {
      expect(card.cardType).toBe("red");
    }
  });

  it("drops bad_behaviour events without a card (non-card bookings)", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 24, name: "Bad Behaviour" },
          location: undefined,
          bad_behaviour: {},
        }),
      ],
      matchInfo,
    );
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pressure (type.id 17)
// ---------------------------------------------------------------------------

describe("statsbomb pressure events", () => {
  it("maps type.id 17 to kind=pressure with coordinates and counterpress=false by default", () => {
    const e = eventsSingle({
      type: { id: 17, name: "Pressure" },
    });

    expect(e.kind).toBe("pressure");
    expect(e.provider).toBe("statsbomb");
    expect(e.x).toBeTypeOf("number");
    expect(e.y).toBeTypeOf("number");
    if (e.kind === "pressure") {
      expect(e.counterpress).toBe(false);
    }
  });

  it("threads counterpress=true from the raw event", () => {
    const e = eventsSingle({
      type: { id: 17, name: "Pressure" },
      counterpress: true,
    });

    if (e.kind === "pressure") {
      expect(e.counterpress).toBe(true);
    }
  });

  it("drops pressure when location is missing", () => {
    const events = fromStatsBomb.events(
      [
        buildEvent({
          type: { id: 17, name: "Pressure" },
          location: undefined,
        }),
      ],
      matchInfo,
    );
    expect(events).toHaveLength(0);
  });

  it("threads duration into sourceMeta when present", () => {
    const e = eventsSingle({
      type: { id: 17, name: "Pressure" },
      duration: 1.24,
    });

    if (e.kind === "pressure") {
      expect(e.sourceMeta?.duration).toBeCloseTo(1.24, 2);
    }
  });

  it("threads under_pressure=true into sourceMeta (chained-press sequences)", () => {
    const e = eventsSingle({
      type: { id: 17, name: "Pressure" },
      under_pressure: true,
    });

    if (e.kind === "pressure") {
      expect(e.sourceMeta?.underPressure).toBe(true);
    }
  });

  it("preserves playerId and teamId identifiers", () => {
    const e = eventsSingle({
      type: { id: 17, name: "Pressure" },
      counterpress: true,
    });

    expect(e.matchId).toBe("12345");
    expect(e.teamId).toBe("1");
    expect(e.playerId).toBe("10");
    expect(e.playerName).toBe("Test Player");
  });
});

// ---------------------------------------------------------------------------
// Stoppage time
// ---------------------------------------------------------------------------

describe("statsbomb stoppage time normalization", () => {
  it("splits first-half stoppage time (minute 47, period 1)", () => {
    const e = eventsSingle({
      type: { id: 10, name: "Interception" },
      minute: 47,
      period: 1,
    });

    expect(e.minute).toBe(45);
    expect(e.addedMinute).toBe(2);
  });

  it("does not emit synthetic +0 stoppage time at the exact period boundary", () => {
    const e = eventsSingle({
      type: { id: 10, name: "Interception" },
      minute: 45,
      period: 1,
    });

    expect(e.minute).toBe(45);
    expect(e.addedMinute).toBeNull();
  });
});
