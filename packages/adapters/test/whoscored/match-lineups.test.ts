import { describe, expect, it } from "vitest";

import { fromWhoScored } from "../../src/whoscored/index.js";
import type {
  WhoScoredMatchCentreData,
  WhoScoredMatchCentreTeam,
} from "../../src/whoscored/index.js";

import matchFixture from "./fixtures/matchcentre-sample.json";

const matchData = matchFixture as unknown as WhoScoredMatchCentreData;
const home = matchFixture.home as unknown as WhoScoredMatchCentreTeam;

describe("fromWhoScored.matchLineups", () => {
  it("decodes a full match-centre blob into home and away team sheets", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });

    expect(result.matchId).toBe("1903447");
    expect(result.home?.teamId).toBe("26");
    expect(result.away?.teamId).toBe("30");
    expect(result.home?.formation).toBe("4231");
    expect(result.away?.formation).toBe("442");
  });

  it("splits the kickoff squad into starters and bench", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });

    expect(result.home?.starters).toHaveLength(11);
    expect(result.home?.bench).toHaveLength(9);
  });

  it("keeps captain information at both team and player level", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });

    expect(result.home?.captainPlayerId).toBe("95408");
    const captain = result.home?.starters.find((player) => player.captain);
    expect(captain?.playerId).toBe("95408");
    expect(captain?.label).toBe("Virgil van Dijk");
  });

  it("maps kickoff starter coordinates, slot, and position code", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });
    const goalkeeper = result.home?.starters.find((player) => player.slot === 1);

    expect(goalkeeper?.label).toBe("Alisson Becker");
    expect(goalkeeper?.positionCode).toBe("GK");
    expect(goalkeeper?.x).toBe(0);
    expect(goalkeeper?.y).toBe(50);
    expect(goalkeeper?.starter).toBe(true);
  });

  it("keeps bench players available as non-starters", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });
    const salah = result.home?.bench.find((player) => player.playerId === "108226");

    expect(salah?.label).toBe("Mohamed Salah");
    expect(salah?.number).toBe(11);
    expect(salah?.starter).toBe(false);
    expect(salah?.slot).toBeUndefined();
  });

  it("applies substitution metadata exposed by later formation intervals", () => {
    const result = fromWhoScored.matchLineups(matchData, { matchId: "1903447" });
    const nyoni = result.home?.bench.find((player) => player.playerId === "509423");
    const gakpo = result.home?.starters.find((player) => player.playerId === "352825");

    expect(nyoni?.substitutedIn).toBe(true);
    expect(nyoni?.minuteOn).toBe(85);
    expect(gakpo?.substitutedOut).toBe(true);
    expect(gakpo?.minuteOff).toBe(85);
  });

  it("throws when a team is missing teamId", () => {
    const broken: WhoScoredMatchCentreData = {
      ...matchData,
      home: {
        ...home,
        teamId: undefined as unknown as number,
      },
    };

    expect(() => fromWhoScored.matchLineups(broken, { matchId: "1903447" })).toThrow(
      /missing teamId/,
    );
  });

  it("throws on inconsistent formationSlots length", () => {
    const kickoff = home.formations[0];
    expect(kickoff).toBeDefined();

    const broken: WhoScoredMatchCentreData = {
      ...matchData,
      home: {
        ...home,
        formations: [
          {
            ...kickoff!,
            formationSlots: [1, 2, 3],
          },
        ],
      },
    };

    expect(() => fromWhoScored.matchLineups(broken, { matchId: "1903447" })).toThrow(
      /formationSlots/i,
    );
  });
});
