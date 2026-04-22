import { describe, expect, it } from "vitest";

import type { MatchContext } from "@withqwerty/campos-schema";

import { fromOpta } from "../../src/index";

import manUtdVsSpurs from "../fixtures/opta/raw-shots-man-utd-vs-spurs.json";
import evertonVsWatford from "../fixtures/opta/raw-goal-everton-vs-watford.json";
import matchEventsSample from "../fixtures/opta/raw-match-events-sample.json";

describe("fromOpta.shots", () => {
  it("maps qualifier 140/141 to endX/endY when the Opta feed includes shot end coordinates", () => {
    const [home, away] = matchEventsSample.matchInfo.contestant as unknown as [
      { id: string },
      { id: string },
    ];
    const shots = fromOpta.shots(
      matchEventsSample.liveData.event,
      buildMatchContext(home.id, away.id, matchEventsSample.matchInfo.id),
    );

    const withEnd = shots.find((s) => s.providerEventId === "1010");
    expect(withEnd).toBeDefined();
    expect(withEnd?.endX).toBeTypeOf("number");
    expect(withEnd?.endY).toBeTypeOf("number");
  });

  function buildMatchContext(
    homeTeamId: string,
    awayTeamId: string,
    matchId: string,
  ): MatchContext {
    return {
      matchId,
      homeTeamId,
      awayTeamId,
      periods: {
        firstHalf: { homeAttacksToward: "decreasing-x" },
        secondHalf: { homeAttacksToward: "increasing-x" },
      },
    };
  }

  it("normalizes raw Opta shot events into Campos shot entities", () => {
    const [home, away] = manUtdVsSpurs.matchInfo.contestant as unknown as [
      { id: string },
      { id: string },
    ];
    const shots = fromOpta.shots(
      manUtdVsSpurs.liveData.event,
      buildMatchContext(home.id, away.id, manUtdVsSpurs.matchInfo.id),
    );

    expect(shots).toHaveLength(3);

    // Spurs (away) attacks increasing-x in P1 → no rotation, raw y preserved.
    expect(shots[0]).toMatchObject({
      kind: "shot",
      id: `${manUtdVsSpurs.matchInfo.id}:299839800`,
      teamId: "22doj4sgsocqpxw45h607udje",
      playerName: "C. Eriksen",
      x: 90.2,
      y: 61,
      outcome: "off-target",
      bodyPart: "left-foot",
      context: "regular-play",
      xg: null,
    });

    expect(shots[1]).toMatchObject({
      id: `${manUtdVsSpurs.matchInfo.id}:2033239262`,
      playerName: "K. Walker",
      outcome: "saved",
      bodyPart: "right-foot",
      y: 35.3,
      isOwnGoal: false,
    });

    expect(shots[2]).toMatchObject({
      id: `${manUtdVsSpurs.matchInfo.id}:2129684969`,
      playerName: "T. Alderweireld",
      outcome: "blocked",
      bodyPart: "head",
      context: "from-corner",
    });
  });

  it("drops own goals from the shot adapter output", () => {
    const [home, away] = manUtdVsSpurs.matchInfo.contestant as unknown as [
      { id: string },
      { id: string },
    ];
    const shots = fromOpta.shots(
      manUtdVsSpurs.liveData.event,
      buildMatchContext(home.id, away.id, manUtdVsSpurs.matchInfo.id),
    );

    expect(shots.find((shot) => shot.providerEventId === "1820237373")).toBeUndefined();
  });

  it("reads xG when the raw Opta event carries qualifier 213", () => {
    const [home, away] = evertonVsWatford.matchInfo.contestant as unknown as [
      { id: string },
      { id: string },
    ];
    const shots = fromOpta.shots(
      evertonVsWatford.liveData.event,
      buildMatchContext(home.id, away.id, evertonVsWatford.matchInfo.id),
    );

    expect(shots).toHaveLength(1);
    // Watford (away) attacks increasing-x in P1 → no rotation, raw y preserved.
    expect(shots[0]).toMatchObject({
      kind: "shot",
      outcome: "goal",
      xg: 0.24,
      bodyPart: "right-foot",
      y: 46,
    });
  });

  it("attack-relative context: passes x and y through unchanged", () => {
    // Opta EG feeds are pre-normalized: every event is already in the
    // acting team's attacker-perspective frame. The adapter just passes
    // coordinates through. Period direction is irrelevant for this path.
    const shots = fromOpta.shots(
      [
        {
          id: 1,
          eventId: 1,
          typeId: 16,
          periodId: 1,
          timeMin: 40,
          timeSec: 14,
          contestantId: "home",
          outcome: 1,
          x: 92.7,
          y: 49.0,
          playerName: "J. Matip",
          qualifier: [{ qualifierId: 321, value: "0.094" }, { qualifierId: 15 }],
        },
        {
          id: 2,
          eventId: 2,
          typeId: 16,
          periodId: 2,
          timeMin: 84,
          timeSec: 2,
          contestantId: "away",
          outcome: 1,
          x: 89.5,
          y: 49.8,
          playerName: "L. Torreira",
          qualifier: [{ qualifierId: 321, value: "0.099" }, { qualifierId: 20 }],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        attackRelative: true,
        periods: {
          firstHalf: { homeAttacksToward: "increasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots).toHaveLength(2);
    expect(shots[0]?.x).toBeCloseTo(92.7, 1);
    expect(shots[0]?.y).toBeCloseTo(49.0, 1);
    expect(shots[0]?.xg).toBe(0.094);
    expect(shots[1]?.x).toBeCloseTo(89.5, 1);
    expect(shots[1]?.y).toBeCloseTo(49.8, 1);
    expect(shots[1]?.xg).toBe(0.099);
  });

  it("reads xG when the raw Opta event carries qualifier 321 (EG feed variant)", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 564806028,
          eventId: 19,
          typeId: 13,
          periodId: 1,
          timeMin: 1,
          timeSec: 18,
          contestantId: "home",
          outcome: 1,
          x: 75.5,
          y: 75.3,
          playerName: "A. Robertson",
          qualifier: [{ qualifierId: 72 }, { qualifierId: 321, value: "0.0225" }],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots).toHaveLength(1);
    expect(shots[0]?.xg).toBe(0.0225);
  });

  it("normalizes StatsPerform goal-mouth qualifiers into the canonical goal frame", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 10,
          eventId: 10,
          typeId: 15,
          periodId: 1,
          timeMin: 22,
          timeSec: 5,
          contestantId: "home",
          outcome: 1,
          x: 90.1,
          y: 48.8,
          playerName: "Forward",
          qualifier: [
            { qualifierId: 72 },
            { qualifierId: 102, value: "52.1" },
            { qualifierId: 103, value: "18.4" },
          ],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "increasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots).toHaveLength(1);
    expect(shots[0]?.goalMouthY).toBe(28.1);
    expect(shots[0]?.goalMouthZ).toBe(48.4);
  });

  it("throws when period direction context is missing", () => {
    expect(() =>
      fromOpta.shots([], {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
      }),
    ).toThrow(/firstHalf\/secondHalf/);
  });

  it("flips second-half shots into Campos attacking direction", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 10,
          eventId: 10,
          typeId: 13,
          periodId: 2,
          timeMin: 47,
          timeSec: 2,
          contestantId: "away",
          outcome: 0,
          x: 18,
          y: 30,
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots[0]).toMatchObject({
      x: 82,
      y: 70,
    });
  });

  it("maps penalty context ahead of generic set-piece flags", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 11,
          eventId: 11,
          typeId: 15,
          periodId: 1,
          timeMin: 12,
          timeSec: 0,
          contestantId: "home",
          outcome: 1,
          x: 89,
          y: 50,
          qualifier: [{ qualifierId: 9 }, { qualifierId: 24 }],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots[0]?.context).toBe("penalty");
    expect(shots[0]?.isPenalty).toBe(true);
  });

  it("rejects unsupported periods instead of casting them through", () => {
    expect(() =>
      fromOpta.shots(
        [
          {
            id: 12,
            eventId: 12,
            typeId: 13,
            periodId: 6,
            timeMin: 90,
            timeSec: 0,
            contestantId: "home",
            outcome: 0,
            x: 70,
            y: 40,
          },
        ],
        {
          matchId: "m1",
          homeTeamId: "home",
          awayTeamId: "away",
          periods: {
            firstHalf: { homeAttacksToward: "decreasing-x" },
            secondHalf: { homeAttacksToward: "increasing-x" },
          },
        },
      ),
    ).toThrow(/Unsupported Opta periodId/);
  });

  it("drops penalty-shootout shots from the normalized output", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 15,
          eventId: 15,
          typeId: 16,
          periodId: 5,
          timeMin: 121,
          timeSec: 0,
          contestantId: "home",
          outcome: 1,
          x: 76,
          y: 48,
          qualifier: [{ qualifierId: 213, value: "0.79" }],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots).toEqual([]);
  });

  it("uses extra-time direction fields for extra-time shots", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 13,
          eventId: 13,
          typeId: 13,
          periodId: 3,
          timeMin: 97,
          timeSec: 0,
          contestantId: "home",
          outcome: 0,
          x: 22,
          y: 35,
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
          extraTimeFirstHalf: { homeAttacksToward: "increasing-x" },
          extraTimeSecondHalf: { homeAttacksToward: "decreasing-x" },
        },
      },
    );

    // Home attacks increasing-x in ET1 → no rotation, both axes preserved.
    expect(shots[0]).toMatchObject({
      x: 22,
      y: 35,
      period: 3,
    });
  });

  it("throws when an extra-time shot is missing extra-time direction context", () => {
    expect(() =>
      fromOpta.shots(
        [
          {
            id: 14,
            eventId: 14,
            typeId: 13,
            periodId: 4,
            timeMin: 108,
            timeSec: 0,
            contestantId: "away",
            outcome: 0,
            x: 34,
            y: 28,
          },
        ],
        {
          matchId: "m1",
          homeTeamId: "home",
          awayTeamId: "away",
          periods: {
            firstHalf: { homeAttacksToward: "decreasing-x" },
            secondHalf: { homeAttacksToward: "increasing-x" },
          },
        },
      ),
    ).toThrow(/extra-time shots/);
  });

  it("drops disallowed goal events from the shot output", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 16,
          eventId: 16,
          typeId: 16,
          periodId: 1,
          timeMin: 32,
          timeSec: 0,
          contestantId: "home",
          outcome: 1,
          x: 91,
          y: 52,
          qualifier: [{ qualifierId: 8 }],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots).toEqual([]);
  });

  it("treats malformed xG qualifiers as null and keeps provider provenance", () => {
    const shots = fromOpta.shots(
      [
        {
          id: 17,
          eventId: 17,
          typeId: 15,
          periodId: 1,
          timeMin: 25,
          timeSec: 0,
          contestantId: "home",
          playerId: "player-17",
          playerName: "Example Player",
          outcome: 1,
          x: 86,
          y: 38,
          qualifier: [
            { qualifierId: 20 },
            { qualifierId: 213, value: "not-a-number" },
            { qualifierId: 24 },
          ],
        },
      ],
      {
        matchId: "m1",
        homeTeamId: "home",
        awayTeamId: "away",
        periods: {
          firstHalf: { homeAttacksToward: "decreasing-x" },
          secondHalf: { homeAttacksToward: "increasing-x" },
        },
      },
    );

    expect(shots[0]).toMatchObject({
      kind: "shot",
      xg: null,
      provider: "opta",
      providerEventId: "17",
      sourceMeta: {
        typeId: 15,
        eventId: 17,
        outcome: 1,
      },
    });
  });
});

describe("fromOpta.events", () => {
  function buildMatchContext(
    homeTeamId: string,
    awayTeamId: string,
    matchId: string,
  ): MatchContext {
    return {
      matchId,
      homeTeamId,
      awayTeamId,
      periods: {
        firstHalf: { homeAttacksToward: "decreasing-x" },
        secondHalf: { homeAttacksToward: "increasing-x" },
      },
    };
  }

  it("includes own goals and disallowed goals in events output", () => {
    const [home, away] = manUtdVsSpurs.matchInfo.contestant as unknown as [
      { id: string },
      { id: string },
    ];
    const events = fromOpta.events(
      manUtdVsSpurs.liveData.event,
      buildMatchContext(home.id, away.id, manUtdVsSpurs.matchInfo.id),
    );

    // events() is loss-aware — includes own goals that shots() drops
    expect(events.length).toBeGreaterThanOrEqual(
      fromOpta.shots(
        manUtdVsSpurs.liveData.event,
        buildMatchContext(home.id, away.id, manUtdVsSpurs.matchInfo.id),
      ).length,
    );
  });
});
