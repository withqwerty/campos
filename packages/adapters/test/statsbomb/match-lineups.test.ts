import { describe, expect, it } from "vitest";

import type {
  StatsBombEvent,
  StatsBombLineupTeam,
  StatsBombMatchInfo,
} from "../../src/statsbomb/parse";
import { fromStatsBomb } from "../../src/index";

import fixture from "../fixtures/statsbomb/raw-match-lineups-barcelona-vs-alaves.json";

const lineups = fixture.lineups as unknown as StatsBombLineupTeam[];
const events = fixture.events as unknown as StatsBombEvent[];
const matchInfo: StatsBombMatchInfo = fixture.matchInfo;

describe("fromStatsBomb.matchLineups", () => {
  it("decodes home and away team sheets from lineups plus events", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);

    expect(result.matchId).toBe("15946");
    expect(result.home?.teamId).toBe("217");
    expect(result.away?.teamId).toBe("206");
    expect(result.home?.formation).toBe("442");
    expect(result.away?.formation).toBe("451");
  });

  it("splits each team into starters and bench from the separate lineup payload", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);

    expect(result.home?.starters).toHaveLength(11);
    expect(result.home?.bench).toHaveLength(3);
    expect(result.away?.starters).toHaveLength(11);
    expect(result.away?.bench).toHaveLength(3);
  });

  it("maps kickoff starter slot and position code from Starting XI tactics", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);
    const goalkeeper = result.home?.starters.find((player) => player.slot === 1);

    expect(goalkeeper?.playerId).toBe("20055");
    expect(goalkeeper?.label).toBe("Marc-André ter Stegen");
    expect(goalkeeper?.number).toBe(1);
    expect(goalkeeper?.positionCode).toBe("GK");
    expect(goalkeeper?.starter).toBe(true);
    expect(goalkeeper?.x).toBeUndefined();
    expect(goalkeeper?.y).toBeUndefined();
  });

  it("keeps bench players as non-starters and enriches substitutes from tactical shifts", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);
    const coutinho = result.home?.bench.find((player) => player.playerId === "3501");

    expect(coutinho?.label).toBe("Philippe Coutinho");
    expect(coutinho?.number).toBe(7);
    expect(coutinho?.starter).toBe(false);
    expect(coutinho?.slot).toBeUndefined();
    expect(coutinho?.positionCode).toBe("LCM");
  });

  it("applies substitution metadata from real substitution events", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);
    const semedo = result.home?.starters.find((player) => player.playerId === "6374");
    const coutinho = result.home?.bench.find((player) => player.playerId === "3501");
    const jony = result.away?.starters.find((player) => player.playerId === "6581");
    const borja = result.away?.bench.find((player) => player.playerId === "6566");

    expect(semedo?.substitutedOut).toBe(true);
    expect(semedo?.minuteOff).toBe(45);
    expect(coutinho?.substitutedIn).toBe(true);
    expect(coutinho?.minuteOn).toBe(45);
    expect(jony?.substitutedOut).toBe(true);
    expect(jony?.minuteOff).toBe(67);
    expect(borja?.substitutedIn).toBe(true);
    expect(borja?.minuteOn).toBe(67);
  });

  it("keeps the kickoff formation rather than pretending to reconstruct the full tactical history", () => {
    const result = fromStatsBomb.matchLineups(lineups, events, matchInfo);

    expect(result.home?.formation).toBe("442");
    expect(result.away?.formation).toBe("451");
    expect(
      result.home?.bench.find((player) => player.playerId === "11392")?.positionCode,
    ).toBe("LCM");
  });

  it("throws when a team is missing its Starting XI event", () => {
    const broken = events.filter(
      (event) => !(event.type.id === 35 && event.team.id === matchInfo.homeTeam.id),
    );

    expect(() => fromStatsBomb.matchLineups(lineups, broken, matchInfo)).toThrow(
      /Starting XI tactics event/,
    );
  });
});
