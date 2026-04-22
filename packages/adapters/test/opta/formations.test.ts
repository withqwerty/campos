import { describe, expect, it } from "vitest";

import { fromOpta } from "../../src/opta/index.js";
import { parseOptaSquads } from "../../src/opta/parse-squads.js";

import lineupFixture from "./fixtures/lineup-event-sample.json";
import squadsFixture from "./fixtures/squads-sample.json";

// Real Alisson Becker player ID from the Liverpool vs Bournemouth fixture
// (2025-08-15). Extracted from /Volumes/WQ/projects/www/src/data/opta/squads.json.
const ALISSON_ID = "53d0pvr7ylvfhp6p749iniqc5";
// Virgil van Dijk (Liverpool captain) from the same fixture.
const VAN_DIJK_ID = "dxze3b3fsfl814bjcs7q6wcet";

describe("parseOptaSquads", () => {
  it("returns an index keyed by player ID", () => {
    const index = parseOptaSquads(squadsFixture);
    expect(index.get(ALISSON_ID)).toBeDefined();
    expect(index.get(VAN_DIJK_ID)).toBeDefined();
  });

  it("includes matchName as the primary label", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get(ALISSON_ID);
    expect(alisson?.label).toBe("Alisson Becker");
  });

  it("includes shirt number", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get(ALISSON_ID);
    expect(alisson?.number).toBe(1);
  });

  it("includes team context", () => {
    const index = parseOptaSquads(squadsFixture);
    const alisson = index.get(ALISSON_ID);
    expect(alisson?.teamId).toBe("c8h9bw1l82s06h77xxrelzhur");
    expect(alisson?.teamName).toBe("Liverpool FC");
  });

  it("skips non-player entries (coaches, staff)", () => {
    const withCoach = {
      squad: [
        {
          contestantId: "team1",
          contestantName: "Test",
          contestantCode: "TST",
          person: [
            {
              id: "p1",
              firstName: "A",
              lastName: "B",
              matchName: "B",
              position: "Goalkeeper",
              type: "player",
              shirtNumber: 1,
              active: "yes",
            },
            {
              id: "c1",
              firstName: "C",
              lastName: "D",
              matchName: "D",
              position: "Manager",
              type: "coach",
              shirtNumber: 0,
              active: "yes",
            },
          ],
        },
      ],
    };
    const index = parseOptaSquads(withCoach);
    expect(index.get("p1")).toBeDefined();
    expect(index.get("c1")).toBeUndefined();
  });

  it("throws on malformed input (no `squad` key)", () => {
    expect(() =>
      parseOptaSquads({} as unknown as Parameters<typeof parseOptaSquads>[0]),
    ).toThrow(/missing `squad`/);
  });
});

describe("fromOpta.formations", () => {
  const squads = parseOptaSquads(squadsFixture);

  it("decodes a real Opta typeId 34 lineup event", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    // Liverpool's formation in the fixture match is Opta ID 8 → "4231".
    expect(result.formation).toBe("4231");
    expect(result.players).toHaveLength(11);
  });

  it("assigns each starter an explicit slot 1-11", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    const slots = result.players.map((p) => p.slot).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("populates positionCode from the mplsoccer table", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.players.find((p) => p.slot === 1)?.positionCode).toBe("GK");
  });

  it("populates label from the squad index", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    const withLabels = result.players.filter((p) => p.label != null).length;
    expect(withLabels).toBe(11);
  });

  it("populates jersey numbers from qualifier 59", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.players.every((p) => typeof p.number === "number")).toBe(true);
    // Slot 1 is Alisson, jersey 1.
    expect(result.players.find((p) => p.slot === 1)?.number).toBe(1);
  });

  it("populates playerId for every starter", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(
      result.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
  });

  it("marks exactly one captain from qualifier 194", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    const captains = result.players.filter((p) => p.captain === true);
    expect(captains).toHaveLength(1);
    // Van Dijk is Liverpool's captain in the fixture.
    expect(captains[0]?.playerId).toBe(VAN_DIJK_ID);
  });

  it("throws on missing qualifier 130", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.filter((q) => q.qualifierId !== 130),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(/qualifier 130/);
  });

  it("throws on missing qualifier 30", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.filter((q) => q.qualifierId !== 30),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(/qualifier 30/);
  });

  it("throws on unknown Opta formation ID", () => {
    const broken = {
      ...lineupFixture.home,
      qualifier: lineupFixture.home.qualifier.map((q) =>
        q.qualifierId === 130 ? { ...q, value: "999" } : q,
      ),
    };
    expect(() => fromOpta.formations(broken, { squads })).toThrow(
      /unknown Opta formation ID/,
    );
  });

  it("returns label: undefined for players not in the squad index", () => {
    const emptySquads = new Map();
    const result = fromOpta.formations(lineupFixture.home, {
      squads: emptySquads,
    });
    // Does NOT throw, and still has slot + positionCode + playerId.
    expect(result.players[0]?.label).toBeUndefined();
    expect(result.players[0]?.slot).toBeDefined();
    expect(result.players[0]?.positionCode).toBeDefined();
    expect(result.players[0]?.playerId).toBeDefined();
  });

  it("populates teamLabel from the squad context when available", () => {
    const result = fromOpta.formations(lineupFixture.home, { squads });
    expect(result.teamLabel).toBe("Liverpool FC");
  });

  it("leaves teamLabel undefined when no lineup player is in the squad index", () => {
    const emptySquads = new Map();
    const result = fromOpta.formations(lineupFixture.home, {
      squads: emptySquads,
    });
    expect(result.teamLabel).toBeUndefined();
  });

  it("decodes the away lineup event (Bournemouth 4141)", () => {
    const result = fromOpta.formations(lineupFixture.away, { squads });
    // Bournemouth's formation in the fixture match is Opta ID 7 → "4141".
    expect(result.formation).toBe("4141");
    expect(result.players).toHaveLength(11);
    expect(result.teamLabel).toBe("AFC Bournemouth");
  });
});
