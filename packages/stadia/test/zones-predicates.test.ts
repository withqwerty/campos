import { describe, expect, it } from "vitest";

import {
  BOX_Y_MAX,
  BOX_Y_MIN,
  CHANNEL_EDGE_HIGH,
  CHANNEL_EDGE_LOW,
  OPPOSITION_BOX_X_MIN,
  OWN_BOX_X_MAX,
  THIRD_EDGE_HIGH,
  THIRD_EDGE_LOW,
  endsInBox,
  endsInChannel,
  endsInThird,
  partitionByZone,
  startsInBox,
  startsInChannel,
  startsInThird,
} from "../src/zones-predicates.js";
import {
  BOX_Y_MAX as SHARED_BOX_Y_MAX,
  THIRD_EDGE_LOW as SHARED_THIRD_EDGE_LOW,
} from "../src/geometry/camposZones.js";

type Ev = {
  id: string;
  x?: number | null;
  y?: number | null;
  endX?: number | null;
  endY?: number | null;
};

describe("startsInThird", () => {
  it("classifies x into defensive / middle / attacking", () => {
    expect(startsInThird("defensive")({ x: 0, y: 50 })).toBe(true);
    expect(startsInThird("defensive")({ x: THIRD_EDGE_LOW - 1e-6, y: 50 })).toBe(true);
    expect(startsInThird("defensive")({ x: THIRD_EDGE_LOW, y: 50 })).toBe(false);

    expect(startsInThird("middle")({ x: THIRD_EDGE_LOW, y: 50 })).toBe(true);
    expect(startsInThird("middle")({ x: THIRD_EDGE_HIGH - 1e-6, y: 50 })).toBe(true);
    expect(startsInThird("middle")({ x: THIRD_EDGE_HIGH, y: 50 })).toBe(false);

    expect(startsInThird("attacking")({ x: THIRD_EDGE_HIGH, y: 50 })).toBe(true);
    expect(startsInThird("attacking")({ x: 100, y: 50 })).toBe(true);
  });

  it("returns false for events missing x", () => {
    expect(startsInThird("middle")({ y: 50 })).toBe(false);
    expect(startsInThird("defensive")({ x: null, y: 50 })).toBe(false);
  });
});

describe("endsInThird", () => {
  it("classifies endX, not x", () => {
    expect(endsInThird("attacking")({ x: 10, y: 50, endX: 90, endY: 50 })).toBe(true);
    expect(endsInThird("defensive")({ x: 90, y: 50, endX: 10, endY: 50 })).toBe(true);
  });

  it("returns false when endX is missing", () => {
    expect(endsInThird("middle")({ x: 50, y: 50 })).toBe(false);
  });
});

describe("startsInChannel", () => {
  it("classifies y into right (low) / center / left (high) matching Campos y grows toward attacker's left", () => {
    expect(startsInChannel("right")({ x: 50, y: 0 })).toBe(true);
    expect(startsInChannel("right")({ x: 50, y: CHANNEL_EDGE_LOW - 1e-6 })).toBe(true);
    expect(startsInChannel("center")({ x: 50, y: CHANNEL_EDGE_LOW })).toBe(true);
    expect(startsInChannel("center")({ x: 50, y: CHANNEL_EDGE_HIGH - 1e-6 })).toBe(true);
    expect(startsInChannel("left")({ x: 50, y: CHANNEL_EDGE_HIGH })).toBe(true);
    expect(startsInChannel("left")({ x: 50, y: 100 })).toBe(true);
  });
});

describe("endsInChannel", () => {
  it("classifies endY", () => {
    expect(endsInChannel("left")({ x: 50, y: 0, endX: 90, endY: 80 })).toBe(true);
    expect(endsInChannel("right")({ x: 50, y: 80, endX: 90, endY: 10 })).toBe(true);
  });
});

describe("startsInBox / endsInBox", () => {
  it("requires both x and y inside the box bounding rectangle", () => {
    // Opposition box centre-ish
    expect(startsInBox("opposition")({ x: OPPOSITION_BOX_X_MIN + 1, y: 50 })).toBe(true);
    // Just outside in x
    expect(startsInBox("opposition")({ x: OPPOSITION_BOX_X_MIN - 0.1, y: 50 })).toBe(
      false,
    );
    // Wide of the box in y
    expect(startsInBox("opposition")({ x: 95, y: BOX_Y_MIN - 0.1 })).toBe(false);
    expect(startsInBox("opposition")({ x: 95, y: BOX_Y_MAX + 0.1 })).toBe(false);

    // Own box
    expect(startsInBox("own")({ x: OWN_BOX_X_MAX - 0.1, y: 50 })).toBe(true);
    expect(startsInBox("own")({ x: OWN_BOX_X_MAX + 0.1, y: 50 })).toBe(false);
  });

  it("endsInBox uses endX/endY", () => {
    expect(endsInBox("opposition")({ x: 10, y: 50, endX: 95, endY: 50 })).toBe(true);
    expect(endsInBox("own")({ x: 90, y: 50, endX: 5, endY: 50 })).toBe(true);
  });
});

describe("partitionByZone", () => {
  const events: Ev[] = [
    { id: "d", x: 10, y: 50 },
    { id: "m", x: 50, y: 50 },
    { id: "a", x: 90, y: 50 },
    { id: "no-x", y: 50 },
  ];

  it("splits into named buckets; unmatched events are dropped", () => {
    const out = partitionByZone(events, {
      defensive: startsInThird("defensive"),
      middle: startsInThird("middle"),
      attacking: startsInThird("attacking"),
    });
    expect(out.defensive.map((e) => e.id)).toEqual(["d"]);
    expect(out.middle.map((e) => e.id)).toEqual(["m"]);
    expect(out.attacking.map((e) => e.id)).toEqual(["a"]);
  });

  it("assigns each event to the first matching predicate (order matters)", () => {
    const out = partitionByZone(events, {
      // Broader predicate first swallows events that would also match a later one.
      any: () => true,
      never: startsInThird("attacking"),
    });
    expect(out.any.length).toBe(4);
    expect(out.never.length).toBe(0);
  });

  it("returns empty arrays for every bucket when the input is empty", () => {
    const out = partitionByZone<Ev, "a" | "b">([], {
      a: () => true,
      b: () => false,
    });
    expect(out.a).toEqual([]);
    expect(out.b).toEqual([]);
  });

  it("handles cross-zone events (start in one third, end in another) using mixed predicates", () => {
    // A progressive pass from defensive → attacking third. Such an event
    // should land in exactly one bucket based on the first matching
    // predicate, not in both.
    const events: Ev[] = [
      { id: "prog", x: 10, y: 50, endX: 90, endY: 50 },
      { id: "carry-back", x: 90, y: 50, endX: 10, endY: 50 },
      { id: "lateral", x: 50, y: 40, endX: 50, endY: 60 },
    ];
    const out = partitionByZone(events, {
      startsDef: startsInThird("defensive"),
      endsAttackingOnly: endsInThird("attacking"),
      middleStart: startsInThird("middle"),
    });
    // "prog" matches both startsDef and endsAttackingOnly; first wins.
    expect(out.startsDef.map((e) => e.id)).toEqual(["prog"]);
    // "carry-back" starts in attacking, ends in defensive — matches
    // endsAttackingOnly? No, endsAttackingOnly fires on endX in
    // attacking, not defensive. Falls through to middleStart? No, x=90
    // is attacking. So unmatched.
    expect(out.endsAttackingOnly.map((e) => e.id)).toEqual([]);
    // "lateral" x=50 is middle.
    expect(out.middleStart.map((e) => e.id)).toEqual(["lateral"]);
  });
});

describe("zone boundary corners", () => {
  it("classifies the pitch corners deterministically", () => {
    // (0, 0): own-defensive-right
    expect(startsInThird("defensive")({ x: 0, y: 0 })).toBe(true);
    expect(startsInChannel("right")({ x: 0, y: 0 })).toBe(true);

    // (100, 100): opposition-attacking-left
    expect(startsInThird("attacking")({ x: 100, y: 100 })).toBe(true);
    expect(startsInChannel("left")({ x: 100, y: 100 })).toBe(true);

    // (50, 50): middle-centre
    expect(startsInThird("middle")({ x: 50, y: 50 })).toBe(true);
    expect(startsInChannel("center")({ x: 50, y: 50 })).toBe(true);
  });

  it("treats BOX_Y_MIN / BOX_Y_MAX as inside the box (inclusive)", () => {
    expect(startsInBox("opposition")({ x: 95, y: BOX_Y_MIN })).toBe(true);
    expect(startsInBox("opposition")({ x: 95, y: BOX_Y_MAX })).toBe(true);
  });

  it("treats OPPOSITION_BOX_X_MIN / OWN_BOX_X_MAX as inside the box (inclusive)", () => {
    expect(startsInBox("opposition")({ x: OPPOSITION_BOX_X_MIN, y: 50 })).toBe(true);
    expect(startsInBox("own")({ x: OWN_BOX_X_MAX, y: 50 })).toBe(true);
  });

  it("re-exported constants are identical to the shared geometry module", () => {
    // Zone predicates and zones.ts both consume these constants; drift
    // between them silently misaligns bins and box tests. This test pins
    // the identity so any future fork of the constants fails loudly.
    expect(THIRD_EDGE_LOW).toBe(SHARED_THIRD_EDGE_LOW);
    expect(BOX_Y_MAX).toBe(SHARED_BOX_Y_MAX);
  });
});
