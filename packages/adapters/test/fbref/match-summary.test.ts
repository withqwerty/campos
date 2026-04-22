import { describe, expect, it } from "vitest";

import { fromFbref } from "../../src/index";

// Field names and schedule semantics come from:
// https://github.com/probberechts/soccerdata/blob/main/soccerdata/fbref.py
// https://github.com/probberechts/soccerdata/blob/main/docs/datasources/FBref.ipynb
describe("fromFbref.matchSummary", () => {
  it("parses finished scorelines and xG from the schedule row", () => {
    const result = fromFbref.matchSummary({
      game_id: "db261cb0",
      league: "ENG-Premier League",
      season: 2021,
      date: "2020-09-12T17:30:00Z",
      home_team: "Liverpool",
      away_team: "Leeds United",
      home_xg: 2.7,
      away_xg: 0.3,
      score: "4–3",
      venue: "Anfield",
    });

    expect(result.matchId).toBe("db261cb0");
    expect(result.status).toBe("finished");
    expect(result.statusLabel).toBe("FT");
    expect(result.home.teamLabel).toBe("Liverpool");
    expect(result.home.teamId).toBeUndefined();
    expect(result.home.score).toBe(4);
    expect(result.away.score).toBe(3);
    expect(result.home.xg).toBe(2.7);
    expect(result.away.xg).toBe(0.3);
    expect(result.venue).toBe("Anfield");
  });

  it("maps schedule-note postponements without inventing a score", () => {
    const result = fromFbref.matchSummary({
      home_team: "Arsenal",
      away_team: "Chelsea",
      notes: "Postponed",
      date: "2026-01-03T15:00:00Z",
    });

    expect(result.status).toBe("postponed");
    expect(result.statusLabel).toBe("Postponed");
    expect(result.home.score).toBeUndefined();
    expect(result.away.score).toBeUndefined();
  });

  it("preserves penalty shootout results and resolution on cup ties", () => {
    const result = fromFbref.matchSummary({
      game_id: "cup-final-2024",
      home_team: "Team A",
      away_team: "Team B",
      score: "1–1 (4–3p)",
      date: "2024-05-25T18:00:00Z",
    });

    expect(result.status).toBe("finished");
    expect(result.statusLabel).toBe("AP");
    expect(result.resolvedIn).toBe("shootout");
    expect(result.shootoutWinner).toBe("home");
    expect(result.home.score).toBe(1);
    expect(result.away.score).toBe(1);
    expect(result.home.penalties).toBe(4);
    expect(result.away.penalties).toBe(3);
  });

  it("flags extra-time finishes without synthetic penalties", () => {
    const result = fromFbref.matchSummary({
      home_team: "Team A",
      away_team: "Team B",
      score: "3–2 (AET)",
    });

    expect(result.resolvedIn).toBe("extra-time");
    expect(result.statusLabel).toBe("AET");
    expect(result.home.penalties).toBeUndefined();
    expect(result.away.penalties).toBeUndefined();
  });

  it("refuses to emit a schema-invalid row when a team label is missing", () => {
    expect(() =>
      fromFbref.matchSummary({
        home_team: null as unknown as string,
        away_team: "Chelsea",
      }),
    ).toThrow(/FBref home team/);
  });

  it("maps awarded results to the awarded status rather than finished", () => {
    const result = fromFbref.matchSummary({
      home_team: "Team A",
      away_team: "Team B",
      notes: "Match Awarded",
    });

    expect(result.status).toBe("awarded");
  });
});
