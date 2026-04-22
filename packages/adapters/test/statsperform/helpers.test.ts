import { describe, expect, it } from "vitest";

import {
  buildStatsPerformMatchContext,
  findStatsPerformMa3LineupEvents,
  findStatsPerformQualifierValue,
  mapStatsPerformMa1MatchLineups,
  statsPerformQualifierMap,
  type StatsPerformEvent,
  type StatsPerformMa1Lineup,
  type StatsPerformMatchInfo,
  type StatsPerformSubstitution,
} from "../../src/statsperform/helpers.js";

import ma1Fixture from "../fixtures/statsperform/raw-match-lineups-hamburg-vs-sandhausen-ma1.json";
import ma3Fixture from "../fixtures/statsperform/raw-match-events-hamburg-vs-sandhausen-ma3.json";

const ma1MatchInfo = ma1Fixture.matchInfo as StatsPerformMatchInfo;
const ma1LineUps = ma1Fixture.liveData.lineUp as StatsPerformMa1Lineup[];
const ma1Substitutions = ma1Fixture.liveData.substitute as StatsPerformSubstitution[];

const ma3MatchInfo = ma3Fixture.matchInfo as StatsPerformMatchInfo;
const ma3Events = ma3Fixture.liveData.event as StatsPerformEvent[];

describe("statsperform helpers", () => {
  it("builds attack-direction match context from MA3 direction events", () => {
    const result = buildStatsPerformMatchContext(ma3MatchInfo, ma3Events);

    expect(result.matchId).toBe("71pif9hi2vwzp6q0xzilyxst0");
    expect(result.homeTeamId).toBe("75xi6hloabmnjn2kzgj1g8h1s");
    expect(result.awayTeamId).toBe("884uzyf1wosc7ykji6e18gifp");
    expect(result.periods.firstHalf.homeAttacksToward).toBe("increasing-x");
    expect(result.periods.secondHalf.homeAttacksToward).toBe("decreasing-x");
  });

  it("maps MA1 lineup payloads into canonical team sheets", () => {
    const result = mapStatsPerformMa1MatchLineups(
      ma1MatchInfo,
      ma1LineUps,
      ma1Substitutions,
    );

    expect(result.matchId).toBe("71pif9hi2vwzp6q0xzilyxst0");
    expect(result.home?.formation).toBe("433");
    expect(result.home?.teamLabel).toBe("Hamburger SV");
    expect(result.home?.captainPlayerId).toBe("do9g7p0jtcfngmvq1uzy2tqdx");
    expect(result.home?.starters).toHaveLength(11);
    expect(
      result.home?.bench.find(
        (player) => player.playerId === "3mp7p8tytgkbwi8itxl5mfkrt",
      ),
    ).toMatchObject({
      substitutedIn: true,
      minuteOn: 61,
    });
    expect(
      result.home?.starters.find(
        (player) => player.playerId === "aksjicf4keobpav3tuujngell",
      ),
    ).toMatchObject({
      substitutedOut: true,
      minuteOff: 61,
    });
    expect(result.away?.formation).toBe("451");
    expect(result.away?.starters.find((player) => player.slot === 1)?.playerId).toBe(
      "5ysw8ditixnietm3lejwmw4id",
    );
  });

  it("exposes MA3 lineup seed events and qualifier lookup helpers", () => {
    const { home, away } = findStatsPerformMa3LineupEvents(ma3MatchInfo, ma3Events);
    const directionEvent = ma3Events.find((event) => event.typeId === 32);

    expect(home.contestantId).toBe("75xi6hloabmnjn2kzgj1g8h1s");
    expect(away.contestantId).toBe("884uzyf1wosc7ykji6e18gifp");
    expect(findStatsPerformQualifierValue(home, 130)).toBe("4");
    expect(statsPerformQualifierMap(home).get(194)).toBe("do9g7p0jtcfngmvq1uzy2tqdx");
    expect(directionEvent).toBeTruthy();
    expect(directionEvent && findStatsPerformQualifierValue(directionEvent, 127)).toBe(
      "Left to Right",
    );
  });
});
