import { describe, expect, it } from "vitest";

import type { StatsBombEvent, StatsBombMatchInfo } from "../src/statsbomb/parse";
import { fromStatsBomb } from "../src/statsbomb/index.js";
import { fromOpta } from "../src/opta/index.js";
import { parseOptaSquads } from "../src/opta/parse-squads.js";
import { fromWhoScored } from "../src/whoscored/index.js";
import type { WhoScoredMatchCentreTeam } from "../src/whoscored/index.js";
import argVsFra from "./fixtures/statsbomb/raw-extra-time-argentina-vs-france.json";
import optaLineupFixture from "./opta/fixtures/lineup-event-sample.json";
import optaSquadsFixture from "./opta/fixtures/squads-sample.json";
import whoscoredFixture from "./whoscored/fixtures/matchcentre-sample.json";

/**
 * Cross-provider parity test using the 2022 World Cup Final (Argentina vs France).
 *
 * Fixture: 3 extra-time/shootout shots. shots() drops period 5 (penalty shootout),
 * so only 2 shots survive the filter:
 *   1. Mac Allister (period 3, min 92,  Off T) — StatsBomb [98.2, 23.8]
 *   2. Messi        (period 4, min 107, Goal)  — StatsBomb [116.6, 43.0]
 *
 * Mbappé's shot is period 5 (penalty shootout) and is intentionally excluded.
 *
 * Campos coordinate formula: x = rawX / 120 * 100, y = rawY / 80 * 100
 */

// JSON imports infer number[] for tuples — cast once at the boundary.
const events = argVsFra.event as unknown as StatsBombEvent[];
const matchInfo: StatsBombMatchInfo = {
  id: argVsFra.matchInfo.id,
  homeTeam: argVsFra.matchInfo.homeTeam,
  awayTeam: argVsFra.matchInfo.awayTeam,
};

describe("cross-provider parity", () => {
  it("StatsBomb Argentina vs France shots have correct coordinates and outcomes", () => {
    const shots = fromStatsBomb.shots(events, matchInfo);

    // All shots must sit inside the Campos coordinate range
    for (const shot of shots) {
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
      expect(shot.provider).toBe("statsbomb");
      expect(shot.kind).toBe("shot");
    }

    // Fixture has 3 raw shots but period-5 (penalty shootout) is excluded → 2
    expect(shots).toHaveLength(2);
  });

  it("hand-labeled: Mac Allister shot (period 3, min 92) — off target, right foot, set-piece", () => {
    const shots = fromStatsBomb.shots(events, matchInfo);
    const macAllister = shots.find((s) => s.playerName === "Alexis Mac Allister");

    expect(macAllister).toBeDefined();
    if (!macAllister) return;

    // Coordinate transform: [98.2, 23.8] → x = 98.2/120*100 ≈ 81.83,
    // y = 100 - 23.8/80*100 ≈ 70.25 (canonical Campos: y=0 is attacker's right)
    expect(macAllister.x).toBeCloseTo(81.83, 1);
    expect(macAllister.y).toBeCloseTo(70.25, 1);

    expect(macAllister.outcome).toBe("off-target");
    expect(macAllister.bodyPart).toBe("right-foot");
    // play_pattern "From Free Kick" with shot.type "Open Play" → set-piece
    expect(macAllister.context).toBe("set-piece");
    expect(macAllister.period).toBe(3);
    // minute 92 < period-3 boundary (105) → no added time split
    expect(macAllister.minute).toBe(92);
    expect(macAllister.addedMinute).toBeNull();
    expect(macAllister.teamId).toBe("779"); // Argentina
  });

  it("hand-labeled: Messi goal (period 4, min 107) — goal, left foot", () => {
    const shots = fromStatsBomb.shots(events, matchInfo);
    const messi = shots.find((s) => s.playerName?.includes("Messi"));

    expect(messi).toBeDefined();
    if (!messi) return;

    // Coordinate transform: [116.6, 43.0] → x = 116.6/120*100 ≈ 97.17,
    // y = 100 - 43.0/80*100 ≈ 46.25 (canonical Campos: y=0 is attacker's right)
    expect(messi.x).toBeCloseTo(97.17, 1);
    expect(messi.y).toBeCloseTo(46.25, 1);

    expect(messi.outcome).toBe("goal");
    expect(messi.period).toBe(4);
    // minute 107 < period-4 boundary (120) → addedMinute is null
    expect(messi.minute).toBe(107);
    expect(messi.addedMinute).toBeNull();
    expect(messi.teamId).toBe("779"); // Argentina
  });

  it("period-5 shots (penalty shootout) are excluded from shots()", () => {
    const shots = fromStatsBomb.shots(events, matchInfo);

    // Mbappé's shot is period 5 and must be dropped
    const mbappe = shots.find((s) => s.playerName?.includes("Mbapp"));
    expect(mbappe).toBeUndefined();
  });

  it("events() returns all 3 raw shots from this shot-only fixture", () => {
    const allEvents = fromStatsBomb.events(events, matchInfo);
    const kinds = new Set(allEvents.map((e) => e.kind));

    // Fixture contains only Shot event types (extra-time and shootout moments)
    expect(kinds.has("shot")).toBe(true);
    // events() does not filter period 5 — it returns all recognized events
    expect(allEvents).toHaveLength(3);
  });

  it("matchInfo is wired through to shot IDs and matchId field", () => {
    const shots = fromStatsBomb.shots(events, matchInfo);

    for (const shot of shots) {
      expect(shot.matchId).toBe("3869685");
      // id format: "<matchId>:<providerEventId>"
      expect(shot.id).toMatch(/^3869685:/);
    }
  });
});

/**
 * Cross-provider parity for the formation adapters.
 *
 * The two fixtures are different matches (Opta = Liverpool vs Bournemouth,
 * WhoScored = Liverpool vs Tottenham) so we cannot diff player-for-player.
 * Instead, we assert that both adapters independently produce structurally
 * equivalent canonical `FormationTeamData`: 11 players, valid mplsoccer keys,
 * fully populated positionCode/playerId/number, and no color fields (colors
 * are a consumer/renderer responsibility, not an adapter one).
 */
const whoscoredHome = whoscoredFixture.home as unknown as WhoScoredMatchCentreTeam;

describe("formation adapter parity", () => {
  it("both adapters emit exactly 11 players with slots 1-11", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(optaResult.players).toHaveLength(11);
    expect(wsResult.players).toHaveLength(11);

    const optaSlots = optaResult.players
      .map((p) => p.slot)
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);
    const wsSlots = wsResult.players
      .map((p) => p.slot)
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);
    expect(optaSlots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(wsSlots).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("both adapters emit valid mplsoccer formation keys", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    // mplsoccer convention: non-hyphenated lowercase alphanumeric (e.g. "433", "4231", "352d")
    expect(optaResult.formation).toMatch(/^[a-z0-9]+$/);
    expect(wsResult.formation).toMatch(/^[a-z0-9]+$/);
  });

  it("both adapters populate positionCode for every starter", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(
      optaResult.players.every(
        (p) => typeof p.positionCode === "string" && p.positionCode.length > 0,
      ),
    ).toBe(true);
    expect(
      wsResult.players.every(
        (p) => typeof p.positionCode === "string" && p.positionCode.length > 0,
      ),
    ).toBe(true);
  });

  it("both adapters populate playerId for every starter (as string)", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(
      optaResult.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
    expect(
      wsResult.players.every(
        (p) => typeof p.playerId === "string" && p.playerId.length > 0,
      ),
    ).toBe(true);
  });

  it("both adapters populate number for every starter", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(
      optaResult.players.every(
        (p) => typeof p.number === "number" && !Number.isNaN(p.number),
      ),
    ).toBe(true);
    expect(
      wsResult.players.every(
        (p) => typeof p.number === "number" && !Number.isNaN(p.number),
      ),
    ).toBe(true);
  });

  it("neither adapter emits teamColor (consumer responsibility)", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(optaResult.teamColor).toBeUndefined();
    expect(wsResult.teamColor).toBeUndefined();
  });

  it("neither adapter emits per-player color (consumer responsibility)", () => {
    const optaResult = fromOpta.formations(optaLineupFixture.home, {
      squads: parseOptaSquads(optaSquadsFixture),
    });
    const wsResult = fromWhoScored.formations(whoscoredHome);

    expect(optaResult.players.every((p) => p.color === undefined)).toBe(true);
    expect(wsResult.players.every((p) => p.color === undefined)).toBe(true);
  });
});
