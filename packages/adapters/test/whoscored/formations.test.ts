import { describe, expect, it } from "vitest";

import { fromWhoScored } from "../../src/whoscored/index.js";
import type { WhoScoredMatchCentreTeam } from "../../src/whoscored/index.js";

import matchFixture from "./fixtures/matchcentre-sample.json";

// The fixture is a trimmed snapshot of matchCentreData from WhoScored match
// 1903447 (Liverpool 1-1 Tottenham, 2026-03-15 Premier League). See the
// _meta block inside the JSON file for the R2 source.
const home = matchFixture.home as unknown as WhoScoredMatchCentreTeam;
const away = matchFixture.away as unknown as WhoScoredMatchCentreTeam;

describe("fromWhoScored.formations", () => {
  it("decodes a home team matchCentreData into FormationTeamData", () => {
    const result = fromWhoScored.formations(home);
    expect(result.formation).toMatch(/^\d+$/);
    expect(result.players).toHaveLength(11);
  });

  it("decodes the real Liverpool kickoff formation as 4231", () => {
    // Empirical check against the real Liverpool vs Tottenham fixture.
    const result = fromWhoScored.formations(home);
    expect(result.formation).toBe("4231");
    expect(result.teamLabel).toBe("Liverpool");
  });

  it("decodes the real Tottenham kickoff formation as 442", () => {
    const result = fromWhoScored.formations(away);
    expect(result.formation).toBe("442");
    expect(result.players).toHaveLength(11);
    expect(result.teamLabel).toBe("Tottenham");
  });

  it("assigns each starter an explicit slot 1..11", () => {
    const result = fromWhoScored.formations(home);
    const slots = result.players
      .map((p) => p.slot)
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);
    expect(slots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("populates positionCode from the mplsoccer table (slot 1 = GK)", () => {
    const result = fromWhoScored.formations(home);
    const gk = result.players.find((p) => p.slot === 1);
    expect(gk?.positionCode).toBe("GK");
  });

  it("populates label from players[].name", () => {
    const result = fromWhoScored.formations(home);
    for (const p of result.players) {
      expect(typeof p.label).toBe("string");
      expect(p.label?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("populates label for the starting GK as Alisson Becker", () => {
    const result = fromWhoScored.formations(home);
    const gk = result.players.find((p) => p.slot === 1);
    expect(gk?.label).toBe("Alisson Becker");
  });

  it("populates jersey numbers on every starter", () => {
    const result = fromWhoScored.formations(home);
    for (const p of result.players) {
      expect(typeof p.number).toBe("number");
    }
  });

  it("emits playerId as a non-empty string", () => {
    const result = fromWhoScored.formations(home);
    for (const p of result.players) {
      expect(typeof p.playerId).toBe("string");
      expect(p.playerId?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("marks the captain flagged by formations[0].captainPlayerId", () => {
    const result = fromWhoScored.formations(home);
    const captains = result.players.filter((p) => p.captain === true);
    expect(captains).toHaveLength(1);
    // Liverpool captain in the fixture is Virgil van Dijk (playerId 95408).
    expect(captains[0]?.playerId).toBe("95408");
    expect(captains[0]?.label).toBe("Virgil van Dijk");
  });

  it("throws on missing formations[]", () => {
    const broken = { ...home, formations: undefined as unknown as [] };
    expect(() => fromWhoScored.formations(broken)).toThrow(/missing formations/);
  });

  it("throws on empty formations[]", () => {
    const broken = { ...home, formations: [] };
    expect(() => fromWhoScored.formations(broken)).toThrow(/missing formations/);
  });

  it("throws on missing players[]", () => {
    const broken = { ...home, players: undefined as unknown as [] };
    expect(() => fromWhoScored.formations(broken)).toThrow(/missing players/);
  });

  it("uses formations[0] (kickoff) even when mid-match changes exist", () => {
    // The Liverpool fixture has 4 formation entries (kickoff + 3 substitution
    // intervals) and Tottenham has 5. The adapter must always take [0].
    expect(home.formations.length).toBeGreaterThan(1);
    const kickoff = home.formations[0];
    expect(kickoff).toBeDefined();
    const result = fromWhoScored.formations(home);
    expect(result.formation).toBe(kickoff!.formationName.toLowerCase().replace(/-/g, ""));
  });

  it("throws on inconsistent parallel array lengths", () => {
    const kickoff = home.formations[0];
    expect(kickoff).toBeDefined();
    const broken: WhoScoredMatchCentreTeam = {
      ...home,
      formations: [
        {
          ...kickoff!,
          jerseyNumbers: [1, 2], // too short — mismatches playerIds length
        },
      ],
    };
    expect(() => fromWhoScored.formations(broken)).toThrow(/inconsistent|parallel/i);
  });

  it("throws when playerIds has fewer than 11 entries", () => {
    const kickoff = home.formations[0];
    expect(kickoff).toBeDefined();
    const broken: WhoScoredMatchCentreTeam = {
      ...home,
      formations: [
        {
          ...kickoff!,
          playerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          jerseyNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
      ],
    };
    expect(() => fromWhoScored.formations(broken)).toThrow(/fewer than 11/);
  });
});
