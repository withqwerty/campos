import { describe, expect, it } from "vitest";

import type { PassEvent } from "@withqwerty/campos-schema";

import {
  combinePassNetworks,
  compressPassNetwork,
  deriveInitials,
  inferRecipientsFromNextPass,
  type PassNetworkEdge,
  type PassNetworkNode,
} from "../../src/compute/index";

// ─── deriveInitials ────────────────────────────────────────────────

describe("deriveInitials", () => {
  it("keeps single-token names intact", () => {
    expect(deriveInitials("Raya")).toBe("Raya");
    expect(deriveInitials("Ødegaard")).toBe("Ødegaard");
  });

  it("takes first letters of a two-token name", () => {
    expect(deriveInitials("Martin Ødegaard")).toBe("MØ");
    expect(deriveInitials("Declan Rice")).toBe("DR");
    expect(deriveInitials("Bukayo Saka")).toBe("BS");
  });

  it("takes first + last initials for three-token names", () => {
    expect(deriveInitials("Luis Alberto Suárez")).toBe("LS");
    expect(deriveInitials("Jean-Clair Todibo")).toBe("JT");
  });

  it("collapses extra whitespace", () => {
    expect(deriveInitials("  Martin   Ødegaard  ")).toBe("MØ");
  });

  it("returns a placeholder for empty input", () => {
    expect(deriveInitials("")).toBe("?");
    expect(deriveInitials("   ")).toBe("?");
  });
});

// ─── compressPassNetwork ───────────────────────────────────────────

describe("compressPassNetwork", () => {
  const baseNodes: PassNetworkNode[] = [
    { id: "a", label: "A", x: 0, y: 50, passCount: 5 },
    { id: "b", label: "B", x: 50, y: 30, passCount: 5 },
    { id: "c", label: "C", x: 100, y: 70, passCount: 5 },
  ];
  const baseEdges: PassNetworkEdge[] = [
    { sourceId: "a", targetId: "b", passCount: 4 },
    { sourceId: "b", targetId: "c", passCount: 4 },
  ];

  it("compresses every x-coordinate into the left half", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left" },
    );
    const a = out.nodes.find((n) => n.id === "a")!;
    const b = out.nodes.find((n) => n.id === "b")!;
    const c = out.nodes.find((n) => n.id === "c")!;
    expect(a.x).toBe(0);
    expect(b.x).toBe(25);
    expect(c.x).toBe(50);
    // y is untouched
    expect(a.y).toBe(50);
    expect(b.y).toBe(30);
    expect(c.y).toBe(70);
  });

  it("compresses AND mirrors into the right half", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "right" },
    );
    const a = out.nodes.find((n) => n.id === "a")!;
    const b = out.nodes.find((n) => n.id === "b")!;
    const c = out.nodes.find((n) => n.id === "c")!;
    // x=0 (own goal) → 100 (own goal on the right), x=100 (attacking) → 50
    // (midfield), so the team still attacks toward the centre.
    expect(a.x).toBe(100);
    expect(b.x).toBe(75);
    expect(c.x).toBe(50);
  });

  it("tags every node and edge with the optional color override", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left", color: "#EF0107" },
    );
    expect(out.nodes.every((n) => n.color === "#EF0107")).toBe(true);
    expect(out.edges.every((e) => e.color === "#EF0107")).toBe(true);
  });

  it("leaves color untouched when the override is omitted", () => {
    const out = compressPassNetwork(
      { nodes: baseNodes, edges: baseEdges },
      { side: "left" },
    );
    expect(out.nodes.every((n) => n.color === undefined)).toBe(true);
    expect(out.edges.every((e) => e.color === undefined)).toBe(true);
  });

  it("preserves passCount, xT, completionRate, and labelFull", () => {
    const input: PassNetworkNode[] = [
      {
        id: "a",
        label: "A",
        labelFull: "Player A",
        x: 20,
        y: 40,
        passCount: 42,
        xT: 0.12,
        completionRate: 0.85,
      },
    ];
    const out = compressPassNetwork({ nodes: input, edges: [] }, { side: "left" });
    const a = out.nodes[0]!;
    expect(a.label).toBe("A");
    expect(a.labelFull).toBe("Player A");
    expect(a.passCount).toBe(42);
    expect(a.xT).toBe(0.12);
    expect(a.completionRate).toBe(0.85);
  });
});

// ─── combinePassNetworks ───────────────────────────────────────────

describe("combinePassNetworks", () => {
  it("concatenates nodes and edges from every input in order", () => {
    const home = {
      nodes: [{ id: "h1", label: "H1", x: 10, y: 50, passCount: 5 }] as PassNetworkNode[],
      edges: [] as PassNetworkEdge[],
    };
    const away = {
      nodes: [
        { id: "a1", label: "A1", x: 90, y: 50, passCount: 5 },
        { id: "a2", label: "A2", x: 80, y: 50, passCount: 5 },
      ] as PassNetworkNode[],
      edges: [{ sourceId: "a1", targetId: "a2", passCount: 4 }] as PassNetworkEdge[],
    };
    const combined = combinePassNetworks(home, away);
    expect(combined.nodes.map((n) => n.id)).toEqual(["h1", "a1", "a2"]);
    expect(combined.edges).toHaveLength(1);
    expect(combined.edges[0]!.sourceId).toBe("a1");
  });

  it("returns empty arrays when called with no inputs", () => {
    const combined = combinePassNetworks();
    expect(combined.nodes).toEqual([]);
    expect(combined.edges).toEqual([]);
  });
});

// ─── inferRecipientsFromNextPass ───────────────────────────────────

function makePass(
  partial: Partial<PassEvent> & {
    id: string;
    teamId: string;
    playerName: string | null;
    minute: number;
    second: number;
    recipient?: string | null;
  },
): PassEvent {
  return {
    kind: "pass",
    id: partial.id,
    matchId: "m1",
    teamId: partial.teamId,
    playerId: null,
    playerName: partial.playerName,
    minute: partial.minute,
    addedMinute: null,
    second: partial.second,
    period: 1,
    x: 50,
    y: 50,
    endX: 55,
    endY: 55,
    length: null,
    angle: null,
    recipient: partial.recipient ?? null,
    passType: "ground",
    passResult: "complete",
    isAssist: false,
    provider: "whoscored",
    providerEventId: partial.id,
  };
}

describe("inferRecipientsFromNextPass", () => {
  it("fills a missing recipient from the next same-team passer", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 10 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    expect(out[0]!.recipient).toBe("Saliba");
    expect(out[1]!.recipient).toBeNull();
  });

  it("leaves non-null recipients untouched", () => {
    const passes: PassEvent[] = [
      makePass({
        id: "1",
        teamId: "home",
        playerName: "Raya",
        minute: 0,
        second: 5,
        recipient: "EXPLICIT",
      }),
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 10 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    expect(out[0]!.recipient).toBe("EXPLICIT");
  });

  it("skips across opposition possession and uses the next same-team passer", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      makePass({ id: "2", teamId: "away", playerName: "Haaland", minute: 0, second: 8 }),
      makePass({ id: "3", teamId: "home", playerName: "Saliba", minute: 0, second: 12 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    expect(out[0]!.recipient).toBe("Saliba");
  });

  it("does not infer across a long time gap (>15s default)", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      // 20-second gap — longer than the default 15s window
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 25 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    expect(out[0]!.recipient).toBeNull();
  });

  it("honours a custom maxGapSeconds", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 25 }),
    ];
    const out = inferRecipientsFromNextPass(passes, { maxGapSeconds: 30 });
    expect(out[0]!.recipient).toBe("Saliba");
  });

  it("skips self-passes (next pass by the same player)", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      makePass({ id: "2", teamId: "home", playerName: "Raya", minute: 0, second: 7 }),
      makePass({ id: "3", teamId: "home", playerName: "Saliba", minute: 0, second: 10 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    expect(out[0]!.recipient).toBe("Saliba");
  });

  it("sorts the input by (minute, second) before walking", () => {
    const passes: PassEvent[] = [
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 10 }),
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
    ];
    const out = inferRecipientsFromNextPass(passes);
    const raya = out.find((p) => p.id === "1")!;
    expect(raya.recipient).toBe("Saliba");
  });

  it("treats the input as immutable — does not mutate rows in place", () => {
    const passes: PassEvent[] = [
      makePass({ id: "1", teamId: "home", playerName: "Raya", minute: 0, second: 5 }),
      makePass({ id: "2", teamId: "home", playerName: "Saliba", minute: 0, second: 10 }),
    ];
    const frozen = passes.map((p) => ({ ...p }));
    inferRecipientsFromNextPass(passes);
    expect(passes[0]!.recipient).toBeNull();
    expect(passes).toEqual(frozen);
  });
});
