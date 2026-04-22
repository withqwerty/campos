import { describe, expect, it } from "vitest";

import { fromUnderstat } from "../../src/index";

// Field names and schedule semantics come from:
// https://github.com/probberechts/soccerdata/blob/main/soccerdata/understat.py
describe("fromUnderstat.matchSummary", () => {
  it("maps a finished schedule row into MatchSummary", () => {
    const result = fromUnderstat.matchSummary({
      game_id: 460,
      league: "ENG-Premier League",
      season: 1516,
      date: "2015-08-08T13:00:00Z",
      home_team_id: 73,
      away_team_id: 71,
      home_team: "Bournemouth",
      away_team: "Aston Villa",
      home_goals: 0,
      away_goals: 1,
      home_xg: 0.62,
      away_xg: 1.43,
      is_result: true,
      has_data: true,
      url: "https://understat.com/match/460",
    });

    expect(result.matchId).toBe("460");
    expect(result.status).toBe("finished");
    expect(result.statusLabel).toBe("FT");
    expect(result.home.teamId).toBe("73");
    expect(result.home.score).toBe(0);
    expect(result.away.teamId).toBe("71");
    expect(result.away.score).toBe(1);
    expect(result.home.xg).toBe(0.62);
    expect(result.away.xg).toBe(1.43);
    expect(result.kickoff).toBe("2015-08-08T13:00:00.000Z");
  });

  it("keeps upcoming matches as scheduled with null scores", () => {
    const result = fromUnderstat.matchSummary({
      game_id: 999,
      home_team: "Arsenal",
      away_team: "Chelsea",
      is_result: false,
      date: "2026-08-16 16:30:00",
    });

    expect(result.status).toBe("scheduled");
    expect(result.statusLabel).toBeUndefined();
    expect(result.home.score).toBeUndefined();
    expect(result.away.score).toBeUndefined();
  });

  it("refuses to emit a schema-invalid summary when a team label is missing", () => {
    expect(() =>
      fromUnderstat.matchSummary({
        home_team: null as unknown as string,
        away_team: "Chelsea",
      }),
    ).toThrow(/Understat home team/);
  });
});
