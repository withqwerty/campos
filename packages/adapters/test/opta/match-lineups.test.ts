import { describe, expect, it } from "vitest";

import { fromOpta } from "../../src/opta/index.js";
import { parseOptaSquads } from "../../src/opta/parse-squads.js";
import type { RawOptaLineupPair } from "../../src/opta/index.js";

import lineupFixture from "./fixtures/lineup-event-sample.json";
import squadsFixture from "./fixtures/squads-sample.json";

const squads = parseOptaSquads(squadsFixture);
const lineups = lineupFixture as unknown as RawOptaLineupPair;

describe("fromOpta.matchLineups", () => {
  it("decodes paired lineup events into home and away team sheets", () => {
    const result = fromOpta.matchLineups(lineups, {
      squads,
      matchId: "zhs8gg1hvcuqvhkk2itb54pg",
    });

    expect(result.matchId).toBe("zhs8gg1hvcuqvhkk2itb54pg");
    expect(result.home?.teamId).toBe("c8h9bw1l82s06h77xxrelzhur");
    expect(result.away?.teamId).toBe("1pse9ta7a45pi2w2grjim70ge");
    expect(result.home?.formation).toBe("4231");
    expect(result.away?.formation).toBe("4141");
  });

  it("splits both teams into starters and bench", () => {
    const result = fromOpta.matchLineups(lineups, { squads });

    expect(result.home?.starters).toHaveLength(11);
    expect(result.home?.bench).toHaveLength(9);
    expect(result.away?.starters).toHaveLength(11);
    expect(result.away?.bench).toHaveLength(9);
  });

  it("keeps captain and team label from lineup qualifiers plus squad join", () => {
    const result = fromOpta.matchLineups(lineups, { squads });
    const captain = result.home?.starters.find((player) => player.captain);

    expect(result.home?.teamLabel).toBe("Liverpool FC");
    expect(result.home?.captainPlayerId).toBe("dxze3b3fsfl814bjcs7q6wcet");
    expect(captain?.playerId).toBe("dxze3b3fsfl814bjcs7q6wcet");
    expect(captain?.label).toBe("V. van Dijk");
  });

  it("maps starter slot and position code but does not invent coordinates", () => {
    const result = fromOpta.matchLineups(lineups, { squads });
    const goalkeeper = result.home?.starters.find((player) => player.slot === 1);

    expect(goalkeeper?.playerId).toBe("53d0pvr7ylvfhp6p749iniqc5");
    expect(goalkeeper?.positionCode).toBe("GK");
    expect(goalkeeper?.x).toBeUndefined();
    expect(goalkeeper?.y).toBeUndefined();
  });

  it("keeps bench ordering from the raw q30/q59 lists and marks them non-starters", () => {
    const result = fromOpta.matchLineups(lineups, { squads });
    const firstBench = result.home?.bench[0];

    expect(firstBench?.playerId).toBe("20o2dr1mdk18xhxmkujzgak89");
    expect(firstBench?.label).toBe("G. Mamardashvili");
    expect(firstBench?.number).toBe(25);
    expect(firstBench?.starter).toBe(false);
    expect(firstBench?.slot).toBeUndefined();
  });

  it("does not invent substitution or rating metadata in the first Opta version", () => {
    const result = fromOpta.matchLineups(lineups, { squads });
    const starter = result.home?.starters[0];
    const bench = result.home?.bench[0];

    expect(starter?.minuteOn).toBeUndefined();
    expect(starter?.minuteOff).toBeUndefined();
    expect(starter?.rating).toBeUndefined();
    expect(bench?.substitutedIn).toBeUndefined();
    expect(bench?.substitutedOut).toBeUndefined();
  });

  it("throws on missing qualifier 131 because starter/bench split depends on it", () => {
    const broken: RawOptaLineupPair = {
      ...lineups,
      home: {
        ...lineups.home,
        qualifier: lineups.home.qualifier.filter((q) => q.qualifierId !== 131),
      },
    };

    expect(() => fromOpta.matchLineups(broken, { squads })).toThrow(/qualifier 131/);
  });

  it("leaves labels undefined when the squad index is empty", () => {
    const result = fromOpta.matchLineups(lineups, { squads: new Map() });

    expect(result.home?.teamLabel).toBeUndefined();
    expect(result.home?.starters[0]?.label).toBeUndefined();
    expect(result.home?.starters[0]?.slot).toBeDefined();
  });
});
