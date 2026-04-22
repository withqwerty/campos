import { describe, expect, it } from "vitest";

import {
  fromStatsPerform,
  type StatsPerformMa1Document,
  type StatsPerformMa3Document,
} from "../../src/index.js";

import ma1Fixture from "../fixtures/statsperform/raw-match-lineups-hamburg-vs-sandhausen-ma1.json";
import ma3Fixture from "../fixtures/statsperform/raw-match-events-hamburg-vs-sandhausen-ma3.json";
import fullMa3Fixture from "../fixtures/statsperform/raw-match-events-full-hamburg-vs-sandhausen-ma3.json";

const ma1Document = ma1Fixture as StatsPerformMa1Document;
const ma3Document = ma3Fixture as StatsPerformMa3Document;
const fullMa3Document = fullMa3Fixture as StatsPerformMa3Document;

describe("fromStatsPerform", () => {
  it("builds match context from MA3 direction events", () => {
    const result = fromStatsPerform.matchContext(ma3Document);

    expect(result.matchId).toBe("71pif9hi2vwzp6q0xzilyxst0");
    expect(result.homeTeamId).toBe("75xi6hloabmnjn2kzgj1g8h1s");
    expect(result.awayTeamId).toBe("884uzyf1wosc7ykji6e18gifp");
    expect(result.periods?.firstHalf.homeAttacksToward).toBe("increasing-x");
    expect(result.periods?.secondHalf.homeAttacksToward).toBe("decreasing-x");
  });

  it("maps an MA1 document into canonical team sheets", () => {
    const result = fromStatsPerform.matchLineups(ma1Document);

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
    expect(result.away?.formation).toBe("451");
  });

  it("projects kickoff formations from the richer MA1 team sheet surface", () => {
    const home = fromStatsPerform.formations(ma1Document, "home");
    const away = fromStatsPerform.formations(ma1Document, "away");

    expect(home.formation).toBe("433");
    expect(home.players).toHaveLength(11);
    expect(home.players.find((player) => player.slot === 1)).toMatchObject({
      playerId: "8b60vtt1stnmt2uoj0f4lh49h",
      positionCode: "GK",
    });
    expect(away.formation).toBe("451");
    expect(away.players.find((player) => player.slot === 1)).toMatchObject({
      playerId: "5ysw8ditixnietm3lejwmw4id",
      positionCode: "GK",
    });
  });

  it("maps MA3 events into statsperform-branded canonical event packets", () => {
    const events = fromStatsPerform.events(fullMa3Document);

    expect(events.length).toBeGreaterThan(100);
    expect(events.some((event) => event.kind === "pass")).toBe(true);
    expect(events.some((event) => event.kind === "shot")).toBe(true);
    expect(events.every((event) => event.provider === "statsperform")).toBe(true);
  });

  it("exposes pass and shot helper surfaces from the same MA3 document", () => {
    const passes = fromStatsPerform.passes(fullMa3Document);
    const shots = fromStatsPerform.shots(fullMa3Document);

    expect(passes.length).toBeGreaterThan(100);
    expect(shots.length).toBeGreaterThan(10);
    expect(passes.every((event) => event.provider === "statsperform")).toBe(true);
    expect(shots.every((event) => event.provider === "statsperform")).toBe(true);
  });
});
