import { describe, expect, it } from "vitest";

import { fromSofascore } from "../../src/index";

// Status-code mapping and event shape are grounded in:
// https://github.com/oseymour/ScraperFC/blob/main/src/ScraperFC/sofascore.py
// https://github.com/probberechts/soccerdata/blob/main/soccerdata/sofascore.py
describe("fromSofascore.matchSummary", () => {
  it("maps a live event payload into MatchSummary", () => {
    const result = fromSofascore.matchSummary({
      id: 11605966,
      status: {
        code: 6,
        description: "1st half",
        type: "inprogress",
      },
      startTimestamp: 1692806400,
      homeTeam: {
        id: 17,
        name: "Manchester United",
      },
      awayTeam: {
        id: 44,
        name: "Bayern Munich",
      },
      homeScore: {
        current: 1,
      },
      awayScore: {
        current: 2,
      },
      tournament: {
        name: "UEFA Champions League",
      },
      season: {
        name: "2023/2024",
      },
      venue: {
        name: "Old Trafford",
      },
      roundInfo: {
        round: 1,
      },
    });

    expect(result.matchId).toBe("11605966");
    expect(result.status).toBe("live");
    expect(result.statusLabel).toBe("1st half");
    expect(result.home.teamId).toBe("17");
    expect(result.away.teamId).toBe("44");
    expect(result.home.score).toBe(1);
    expect(result.away.score).toBe(2);
    expect(result.competitionLabel).toBe("UEFA Champions League");
    expect(result.seasonLabel).toBe("2023/2024");
    expect(result.venue).toBe("Old Trafford");
    expect(result.sourceMeta).toMatchObject({
      statusCode: 6,
      statusType: "inprogress",
      round: 1,
    });
  });

  it("maps postponed status codes without pretending the match finished", () => {
    const result = fromSofascore.matchSummary({
      id: 2000,
      status: {
        code: 60,
        description: "Postponed",
        type: "postponed",
      },
      homeTeam: {
        id: 1,
        name: "Home FC",
      },
      awayTeam: {
        id: 2,
        name: "Away FC",
      },
    });

    expect(result.status).toBe("postponed");
    expect(result.statusLabel).toBe("Postponed");
    expect(result.home.score).toBeUndefined();
    expect(result.away.score).toBeUndefined();
  });

  it("renders halftime as a live in-game state, not unknown", () => {
    const result = fromSofascore.matchSummary({
      id: 3000,
      status: { code: 31, description: "Halftime", type: "inprogress" },
      homeTeam: { id: 1, name: "Home FC" },
      awayTeam: { id: 2, name: "Away FC" },
    });

    expect(result.status).toBe("halftime");
  });

  it("treats the code-93 removed bucket as finished per the Sofascore type", () => {
    const result = fromSofascore.matchSummary({
      id: 4000,
      status: { code: 93, description: "Removed", type: "finished" },
      homeTeam: { id: 1, name: "Home FC" },
      awayTeam: { id: 2, name: "Away FC" },
    });

    expect(result.status).toBe("finished");
  });
});
