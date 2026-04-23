import { describe, expect, it } from "vitest";

import { fromUnderstat } from "../../src/index";

// Field names and value mappings come from:
// https://github.com/probberechts/soccerdata/blob/main/soccerdata/understat.py
describe("fromUnderstat.shots", () => {
  it("maps shot rows into canonical ShotEvent output", () => {
    const result = fromUnderstat.shots([
      {
        game_id: 460,
        shot_id: 1001,
        team_id: 71,
        team: "Aston Villa",
        player_id: 200,
        player: "Gabriel Agbonlahor",
        assist_player_id: 201,
        assist_player: "Carlos Sánchez",
        xg: 0.44,
        location_x: 0.795,
        location_y: 0.507,
        minute: 72,
        body_part: "Left Foot",
        situation: "Open Play",
        result: "Goal",
      },
      {
        game_id: 460,
        shot_id: 1002,
        team_id: 71,
        team: "Aston Villa",
        player_id: 202,
        player: "Leandro Bacuna",
        xg: 0.08,
        location_x: 0.786,
        location_y: 0.437,
        minute: 88,
        body_part: "Right Foot",
        situation: "Direct Freekick",
        result: "Blocked Shot",
      },
      {
        game_id: 460,
        shot_id: 1003,
        team_id: 73,
        team: "Bournemouth",
        player_id: 301,
        player: "Own Goal Example",
        xg: 0.01,
        location_x: 0.2,
        location_y: 0.4,
        minute: 10,
        body_part: "Other",
        situation: "Open Play",
        result: "Own Goal",
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      kind: "shot",
      provider: "understat",
      matchId: "460",
      teamId: "71",
      playerId: "200",
      playerName: "Gabriel Agbonlahor",
      minute: 72,
      period: 2,
      outcome: "goal",
      bodyPart: "left-foot",
      context: "regular-play",
      isPenalty: false,
      isOwnGoal: false,
    });
    expect(result[0]?.x).toBeCloseTo(79.5);
    // Understat Y=0.507 is just past the top touchline (attacker's left) →
    // Campos y = 100 - 50.7 ≈ 49.3 (just past centre toward attacker's right).
    expect(result[0]?.y).toBeCloseTo(49.3);
    expect(result[0]?.sourceMeta).toMatchObject({
      assistPlayerId: "201",
      assistPlayer: "Carlos Sánchez",
      rawResult: "Goal",
    });

    expect(result[1]).toMatchObject({
      minute: 88,
      outcome: "blocked",
      bodyPart: "right-foot",
      context: "direct-free-kick",
    });
  });

  it("flips the Y axis into Campos canonical (attacker's right = y:0)", () => {
    const [wideRight, wideLeft] = fromUnderstat.shots([
      {
        game_id: 999,
        shot_id: 1,
        team: "A",
        player: "Wide Right Striker",
        xg: 0.1,
        location_x: 0.9,
        location_y: 0.95,
        minute: 10,
        body_part: "Right Foot",
        situation: "Open Play",
        result: "Saved Shot",
      },
      {
        game_id: 999,
        shot_id: 2,
        team: "A",
        player: "Wide Left Striker",
        xg: 0.1,
        location_x: 0.9,
        location_y: 0.05,
        minute: 12,
        body_part: "Left Foot",
        situation: "Open Play",
        result: "Saved Shot",
      },
    ]);

    expect(wideRight?.y).toBeLessThan(10);
    expect(wideLeft?.y).toBeGreaterThan(90);
  });

  it("marks penalty situations when the upstream row preserves that label", () => {
    const [shot] = fromUnderstat.shots([
      {
        game_id: 500,
        shot_id: 9001,
        team_id: 10,
        team: "Penalty FC",
        player_id: 77,
        player: "Penalty Taker",
        xg: 0.79,
        location_x: 0.9,
        location_y: 0.5,
        minute: 51,
        body_part: "Right Foot",
        situation: "Penalty",
        result: "Saved Shot",
      },
    ]);

    expect(shot?.isPenalty).toBe(true);
    expect(shot?.context).toBe("penalty");
    expect(shot?.outcome).toBe("saved");
  });

  it("treats raw 47 as second-half time because Understat cannot expose first-half stoppage fidelity", () => {
    const [shot] = fromUnderstat.shots([
      {
        game_id: 500,
        shot_id: 9000,
        team_id: 10,
        team: "Ambiguity FC",
        player_id: 76,
        player: "Clock Caveat",
        xg: 0.12,
        location_x: 0.82,
        location_y: 0.44,
        minute: 47,
        body_part: "Right Foot",
        situation: "Open Play",
        result: "Saved Shot",
      },
    ]);

    expect(shot).toMatchObject({
      minute: 47,
      addedMinute: null,
      period: 2,
      outcome: "saved",
    });
  });

  it("treats 90+ minutes as second-half stoppage time, not extra time", () => {
    const [shot] = fromUnderstat.shots([
      {
        game_id: 501,
        shot_id: 9002,
        team_id: 10,
        team: "Stoppage FC",
        player_id: 78,
        player: "Late Winner",
        xg: 0.35,
        location_x: 0.88,
        location_y: 0.52,
        minute: 99,
        body_part: "Right Foot",
        situation: "Open Play",
        result: "Goal",
      },
    ]);

    expect(shot).toMatchObject({
      minute: 90,
      addedMinute: 9,
      period: 2,
      outcome: "goal",
    });
  });
});
