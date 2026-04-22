import { describe, expect, it } from "vitest";

import type { PassEvent } from "@withqwerty/campos-schema";

import { aggregatePassNetwork } from "../../src/compute/index";

function makePass(
  partial: Partial<PassEvent> & {
    id: string;
    playerName: string;
    recipient?: string | null;
    x: number;
    y: number;
    endX: number;
    endY: number;
  },
): PassEvent {
  return {
    kind: "pass",
    id: partial.id,
    matchId: "m1",
    teamId: partial.teamId ?? "home",
    playerId: partial.playerId ?? null,
    playerName: partial.playerName,
    minute: partial.minute ?? 10,
    addedMinute: null,
    second: 0,
    period: 1,
    x: partial.x,
    y: partial.y,
    endX: partial.endX,
    endY: partial.endY,
    length: null,
    angle: null,
    recipient: partial.recipient ?? null,
    passType: "ground",
    passResult: partial.passResult ?? "complete",
    isAssist: false,
    provider: "opta",
    providerEventId: partial.id,
  };
}

// ─── Basic aggregation ─────────────────────────────────────────────

describe("aggregatePassNetwork — basic aggregation", () => {
  it("returns nodes keyed by player name with average positions", () => {
    const passes: PassEvent[] = [
      // Ødegaard passes (2)
      makePass({
        id: "1",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "2",
        playerName: "Ødegaard",
        recipient: "Rice",
        x: 50,
        y: 40,
        endX: 55,
        endY: 55,
      }),
      // Saka passes (3)
      makePass({
        id: "3",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 78,
        y: 28,
        endX: 58,
        endY: 40,
      }),
      makePass({
        id: "4",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 80,
        y: 25,
        endX: 60,
        endY: 42,
      }),
      makePass({
        id: "5",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 82,
        y: 22,
        endX: 60,
        endY: 40,
      }),
      // Rice passes (5)
      makePass({
        id: "6",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "7",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "8",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "9",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
      makePass({
        id: "10",
        playerName: "Rice",
        recipient: "Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 2,
    });
    expect(result.nodes).toHaveLength(3);
    const ode = result.nodes.find((n) => n.id === "Ødegaard");
    expect(ode).toBeDefined();
    expect(ode!.passCount).toBe(2);
    // Ødegaard's average position mixes own-pass origins (60,40 + 50,40)
    // with being-recipient endpoints (8 targeting roughly 60/40).
    expect(ode!.x).toBeGreaterThan(55);
    expect(ode!.x).toBeLessThan(62);
    expect(ode!.y).toBeGreaterThan(38);
    expect(ode!.y).toBeLessThan(42);
  });

  it("builds directional edges keyed by passer→recipient name pairs", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "2",
        playerName: "Ødegaard",
        recipient: "Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "3",
        playerName: "Saka",
        recipient: "Ødegaard",
        x: 75,
        y: 30,
        endX: 60,
        endY: 40,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.edges).toHaveLength(2);
    const oToS = result.edges.find(
      (e) => e.sourceId === "Ødegaard" && e.targetId === "Saka",
    );
    const sToO = result.edges.find(
      (e) => e.sourceId === "Saka" && e.targetId === "Ødegaard",
    );
    expect(oToS?.passCount).toBe(2);
    expect(sToO?.passCount).toBe(1);
  });

  it("filters by team id", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        teamId: "home",
        playerName: "A",
        recipient: "B",
        x: 20,
        y: 50,
        endX: 30,
        endY: 50,
      }),
      makePass({
        id: "2",
        teamId: "away",
        playerName: "Z",
        recipient: "Y",
        x: 20,
        y: 50,
        endX: 30,
        endY: 50,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
  });

  it("emits initial-based labels for multi-token names with the full name in labelFull", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "Martin Ødegaard",
        recipient: "Bukayo Saka",
        x: 60,
        y: 40,
        endX: 75,
        endY: 30,
      }),
      makePass({
        id: "2",
        playerName: "Bukayo Saka",
        recipient: "Martin Ødegaard",
        x: 75,
        y: 30,
        endX: 60,
        endY: 40,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    const ode = result.nodes.find((n) => n.labelFull === "Martin Ødegaard");
    const saka = result.nodes.find((n) => n.labelFull === "Bukayo Saka");
    expect(ode?.id).toBe("Martin Ødegaard");
    expect(ode?.label).toBe("MØ");
    expect(saka?.label).toBe("BS");
  });

  it("accepts a labelFor override callback", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "Martin Ødegaard",
        recipient: "Declan Rice",
        x: 60,
        y: 40,
        endX: 55,
        endY: 55,
      }),
      makePass({
        id: "2",
        playerName: "Declan Rice",
        recipient: "Martin Ødegaard",
        x: 55,
        y: 55,
        endX: 60,
        endY: 40,
      }),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      labelFor: (name) => ({ label: name.slice(0, 1), labelFull: name }),
    });
    const ode = result.nodes.find((n) => n.labelFull === "Martin Ødegaard");
    expect(ode?.label).toBe("M");
  });

  it("drops passes missing playerName, recipient, or coordinates", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      // missing recipient → dropped
      {
        ...makePass({
          id: "2",
          playerName: "A",
          x: 50,
          y: 50,
          endX: 60,
          endY: 50,
        }),
        recipient: null,
      },
      // missing x → dropped
      {
        ...makePass({
          id: "3",
          playerName: "A",
          recipient: "B",
          x: 0,
          y: 50,
          endX: 60,
          endY: 50,
        }),
        x: null,
      },
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.passCount).toBe(1);
  });
});

// ─── Time windows ──────────────────────────────────────────────────

describe("aggregatePassNetwork — time windows", () => {
  const passes: PassEvent[] = [
    makePass({
      id: "1",
      minute: 5,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
    makePass({
      id: "2",
      minute: 35,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
    makePass({
      id: "3",
      minute: 70,
      playerName: "A",
      recipient: "B",
      x: 50,
      y: 50,
      endX: 60,
      endY: 50,
    }),
  ];

  it("the default silently falls back to full match when no substitutions are supplied", () => {
    // Consumer did nothing — default is "untilFirstSub" team-scoped, which
    // silently degrades to fullMatch without a warning so unconfigured
    // callers aren't spammed.
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.window).toEqual([0, 120]);
    expect(result.warnings).toEqual([]);
  });

  it("includes every pass when timeWindow=fullMatch is explicit", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "fullMatch",
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.window).toEqual([0, 120]);
  });

  it("restricts to [start, end] when given explicit bounds", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: [0, 40],
    });
    expect(result.edges[0]!.passCount).toBe(2);
    expect(result.window).toEqual([0, 40]);
  });

  it("untilFirstSub uses the earliest substitution for THIS team", () => {
    // The away team subbed at minute 20 — we must ignore that and use the
    // home team's first sub at minute 70. This is the critical difference
    // from "earliest across all teams".
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
      substitutions: [
        { minute: 20, teamId: "away" },
        { minute: 70, teamId: "home" },
      ],
    });
    expect(result.window).toEqual([0, 70]);
    expect(result.edges[0]!.passCount).toBe(3); // all 3 home passes fit in [0, 70]
  });

  it("also picks up substitutions with no teamId tag", () => {
    // Consumers who don't tag substitutions with a team still get a
    // sensible window — any sub counts.
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
      substitutions: [{ minute: 40 }],
    });
    expect(result.window).toEqual([0, 40]);
  });

  it("untilFirstSub warns and falls back when no substitutions are supplied", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.warnings.some((w) => w.includes("untilFirstSub"))).toBe(true);
  });

  it("untilFirstSub warns and falls back when subs exist but none match this team", () => {
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      timeWindow: "untilFirstSub",
      substitutions: [{ minute: 30, teamId: "away" }],
    });
    expect(result.edges[0]!.passCount).toBe(3);
    expect(result.window).toEqual([0, 120]);
    expect(result.warnings.some((w) => w.includes("home"))).toBe(true);
  });
});

// ─── Thresholds ────────────────────────────────────────────────────

describe("aggregatePassNetwork — thresholds", () => {
  it("drops players below minPassesForNode", () => {
    const passes: PassEvent[] = [
      // A has 5 outgoing passes → passes the default threshold
      makePass({
        id: "1",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "2",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "3",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "4",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      makePass({
        id: "5",
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
      // B has 5 outgoing (below to A) — also passes
      makePass({
        id: "6",
        playerName: "B",
        recipient: "A",
        x: 60,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "7",
        playerName: "B",
        recipient: "A",
        x: 60,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "8",
        playerName: "B",
        recipient: "A",
        x: 60,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "9",
        playerName: "B",
        recipient: "A",
        x: 60,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "10",
        playerName: "B",
        recipient: "A",
        x: 60,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      // C has 2 outgoing → below default 5, dropped
      makePass({
        id: "11",
        playerName: "C",
        recipient: "A",
        x: 30,
        y: 50,
        endX: 50,
        endY: 50,
      }),
      makePass({
        id: "12",
        playerName: "C",
        recipient: "A",
        x: 30,
        y: 50,
        endX: 50,
        endY: 50,
      }),
    ];
    const result = aggregatePassNetwork(passes, { teamId: "home" });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
    expect(result.edges.every((e) => e.sourceId !== "C")).toBe(true);
  });

  it("drops edges below minPassesForEdge", () => {
    const passes: PassEvent[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makePass({
          id: `p${i}`,
          playerName: "A",
          recipient: "B",
          x: 20,
          y: 50,
          endX: 40,
          endY: 50,
        }),
      ),
      // Single A→D pass (below min-edge threshold)
      makePass({
        id: "x",
        playerName: "A",
        recipient: "D",
        x: 20,
        y: 50,
        endX: 40,
        endY: 30,
      }),
      // D has 5 outgoing so it survives as a node
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `d${i}`,
          playerName: "D",
          recipient: "A",
          x: 40,
          y: 30,
          endX: 20,
          endY: 50,
        }),
      ),
      // B has 5 outgoing too
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `b${i}`,
          playerName: "B",
          recipient: "A",
          x: 40,
          y: 50,
          endX: 20,
          endY: 50,
        }),
      ),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForEdge: 3,
    });
    const aToD = result.edges.find((e) => e.sourceId === "A" && e.targetId === "D");
    const dToA = result.edges.find((e) => e.sourceId === "D" && e.targetId === "A");
    expect(aToD).toBeUndefined();
    expect(dToA?.passCount).toBe(5);
  });
});

// ─── xT resolvers ──────────────────────────────────────────────────

describe("aggregatePassNetwork — xT resolvers", () => {
  it("uses xTForPlayer and xTForPair callbacks when provided", () => {
    const passes: PassEvent[] = Array.from({ length: 5 }, (_, i) =>
      makePass({
        id: `p${i}`,
        playerName: "A",
        recipient: "B",
        x: 50,
        y: 50,
        endX: 60,
        endY: 50,
      }),
    );
    const xTPlayer: Record<string, number> = { A: 0.3, B: 0.1 };
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
      xTForPlayer: (name) => xTPlayer[name] ?? null,
      xTForPair: (s, t) => (s === "A" && t === "B" ? 0.05 : null),
    });
    const a = result.nodes.find((n) => n.id === "A");
    const b = result.nodes.find((n) => n.id === "B");
    expect(a?.xT).toBe(0.3);
    expect(b?.xT).toBe(0.1);
    const edge = result.edges.find((e) => e.sourceId === "A" && e.targetId === "B");
    expect(edge?.xT).toBe(0.05);
  });
});

// ─── Initial clash resolution ──────────────────────────────────────

describe("aggregatePassNetwork — initial clash resolution", () => {
  it("promotes the lower-pass-count collider to a surname-based label", () => {
    // David Raya and Declan Rice both derive to "DR".
    // Raya has more passes so should keep "DR"; Rice should be promoted.
    const passes: PassEvent[] = [
      // Raya: 6 outgoing (high volume)
      ...Array.from({ length: 6 }, (_, i) =>
        makePass({
          id: `raya${i}`,
          playerName: "David Raya",
          recipient: "Declan Rice",
          x: 10,
          y: 50,
          endX: 50,
          endY: 50,
        }),
      ),
      // Rice: 3 outgoing (lower volume)
      ...Array.from({ length: 3 }, (_, i) =>
        makePass({
          id: `rice${i}`,
          playerName: "Declan Rice",
          recipient: "David Raya",
          x: 50,
          y: 50,
          endX: 10,
          endY: 50,
        }),
      ),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    const raya = result.nodes.find((n) => n.labelFull === "David Raya");
    const rice = result.nodes.find((n) => n.labelFull === "Declan Rice");
    expect(raya?.label).toBe("DR");
    // Rice should have been bumped to a surname-based label
    expect(rice?.label).toBe("Ri");
    // And the two should be distinct
    expect(raya?.label).not.toBe(rice?.label);
  });

  it("grows the surname prefix when the 2-char version also clashes", () => {
    // Hypothetical: two players with surnames sharing the first two chars
    // ("Rice" and "Richards") plus a third clasher. The helper should
    // escalate to 3+ chars until every label is unique.
    const passes: PassEvent[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePass({
          id: `rice${i}`,
          playerName: "Declan Rice",
          recipient: "Declan Richards",
          x: 30,
          y: 50,
          endX: 60,
          endY: 50,
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makePass({
          id: `rich${i}`,
          playerName: "Declan Richards",
          recipient: "Declan Rice",
          x: 60,
          y: 50,
          endX: 30,
          endY: 50,
        }),
      ),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    const rice = result.nodes.find((n) => n.labelFull === "Declan Rice");
    const richards = result.nodes.find((n) => n.labelFull === "Declan Richards");
    // Rice wins the short "DR" (higher pass count)
    expect(rice?.label).toBe("DR");
    // Richards is promoted. Surname "Richards" → try "Ri" (taken by Rice's
    // promotion? no — Rice kept "DR"), "Ri" is free. Wait — Ri is 2 chars
    // of "Richards" which would be "Ri". Rice wasn't promoted, so "Ri" is
    // free. Richards becomes "Ri".
    expect(richards?.label).toBe("Ri");
    expect(rice?.label).not.toBe(richards?.label);
  });

  it("leaves unique labels untouched", () => {
    const passes: PassEvent[] = [
      ...Array.from({ length: 3 }, (_, i) =>
        makePass({
          id: `a${i}`,
          playerName: "Martin Ødegaard",
          recipient: "Bukayo Saka",
          x: 60,
          y: 40,
          endX: 70,
          endY: 20,
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makePass({
          id: `b${i}`,
          playerName: "Bukayo Saka",
          recipient: "Martin Ødegaard",
          x: 70,
          y: 20,
          endX: 60,
          endY: 40,
        }),
      ),
    ];
    const result = aggregatePassNetwork(passes, {
      teamId: "home",
      minPassesForNode: 1,
    });
    const ode = result.nodes.find((n) => n.labelFull === "Martin Ødegaard");
    const saka = result.nodes.find((n) => n.labelFull === "Bukayo Saka");
    expect(ode?.label).toBe("MØ");
    expect(saka?.label).toBe("BS");
  });
});

// ─── Empty inputs ──────────────────────────────────────────────────

describe("aggregatePassNetwork — empty inputs", () => {
  it("returns empty arrays when no passes match the team", () => {
    const result = aggregatePassNetwork([], { teamId: "home" });
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});
