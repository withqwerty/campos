import { describe, expect, it } from "vitest";

import type { StatsBombEvent, StatsBombMatchInfo } from "../../src/statsbomb/parse";
import { fromStatsBomb } from "../../src/index";

import sampleEvents from "../fixtures/statsbomb/raw-match-events-sample.json";
import bayerVsBremen from "../fixtures/statsbomb/raw-shots-bayer-leverkusen-vs-werder-bremen.json";
import barcelonaVsAlaves from "../fixtures/statsbomb/raw-direct-free-kicks-barcelona-vs-alaves.json";
import argentinaVsFrance from "../fixtures/statsbomb/raw-extra-time-argentina-vs-france.json";
import ecuadorVsSenegal from "../fixtures/statsbomb/raw-penalty-ecuador-vs-senegal.json";

// JSON imports infer number[] for tuples — cast once at the boundary.
const sampleEventsTyped = sampleEvents.event as unknown as StatsBombEvent[];
const bayerEventsTyped = bayerVsBremen.event as unknown as StatsBombEvent[];
const barcaFkEventsTyped = barcelonaVsAlaves.event as unknown as StatsBombEvent[];
const argEventsTyped = argentinaVsFrance.event as unknown as StatsBombEvent[];
const ecuEventsTyped = ecuadorVsSenegal.event as unknown as StatsBombEvent[];

function matchInfoFromFixture(fixture: {
  matchInfo: {
    id: number;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
  };
}): StatsBombMatchInfo {
  return {
    id: fixture.matchInfo.id,
    homeTeam: fixture.matchInfo.homeTeam,
    awayTeam: fixture.matchInfo.awayTeam,
  };
}

describe("fromStatsBomb.shots", () => {
  const matchInfo = matchInfoFromFixture(sampleEvents);

  it("normalizes raw StatsBomb shot events into Campos shot entities", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    // 8 shots in fixture, none are own goals or shootout
    expect(shots).toHaveLength(8);

    expect(shots[0]).toMatchObject({
      kind: "shot",
      provider: "statsbomb",
      providerEventId: "c577e730-b9f5-44f2-9257-9e7730c23d7b",
      teamId: "176",
      playerName: "Leonardo Bittencourt",
      outcome: "blocked",
      bodyPart: "right-foot",
      xg: 0.056644168,
      context: "set-piece",
    });
  });

  it("converts coordinates from 120x80 to 0-100 range", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    // First shot: location [100.4, 35.1] → x≈83.67, y=56.125 (canonical Campos
    // inverts StatsBomb's top-to-bottom y so attacker's right = y=0).
    const first = shots[0] as (typeof shots)[0];
    expect(first.x).toBeCloseTo(83.67, 2);
    expect(first.y).toBe(56.125);

    for (const shot of shots) {
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("maps xG from statsbomb_xg field", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    expect((shots[0] as (typeof shots)[0]).xg).toBe(0.056644168);
    expect((shots[1] as (typeof shots)[0]).xg).toBe(0.14338115);

    for (const shot of shots) {
      expect(typeof shot.xg).toBe("number");
    }
  });

  it("maps body parts correctly", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    expect((shots[0] as (typeof shots)[0]).bodyPart).toBe("right-foot");
    expect((shots[1] as (typeof shots)[0]).bodyPart).toBe("left-foot");
    expect((shots[2] as (typeof shots)[0]).bodyPart).toBe("head");
  });

  it("maps outcomes correctly", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    expect((shots[0] as (typeof shots)[0]).outcome).toBe("blocked");
    expect((shots[1] as (typeof shots)[0]).outcome).toBe("saved");
    expect((shots[3] as (typeof shots)[0]).outcome).toBe("off-target");
    expect((shots[4] as (typeof shots)[0]).outcome).toBe("goal");
    // Post → hit-woodwork
    expect((shots[5] as (typeof shots)[0]).outcome).toBe("hit-woodwork");
  });

  it("maps penalty context from shot.type.name", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);
    const penaltyShot = shots.find(
      (s) => s.providerEventId === "cf7357c9-3bd6-425f-ac34-ef7f11897394",
    );

    expect(penaltyShot).toBeDefined();
    const ps = penaltyShot as NonNullable<typeof penaltyShot>;
    expect(ps.context).toBe("penalty");
    expect(ps.isPenalty).toBe(true);
  });

  it("maps set-piece context from From Free Kick play pattern", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);
    const setPieceShot = shots.find(
      (s) => s.providerEventId === "c577e730-b9f5-44f2-9257-9e7730c23d7b",
    );

    expect(setPieceShot).toBeDefined();
    expect((setPieceShot as NonNullable<typeof setPieceShot>).context).toBe("set-piece");
  });

  it("maps direct free-kick context from shot.type.name using a real fixture", () => {
    const info = matchInfoFromFixture(barcelonaVsAlaves);
    const shots = fromStatsBomb.shots(barcaFkEventsTyped, info);
    const freeKickGoal = shots.find(
      (shot) => shot.providerEventId === "f8132d81-31dc-45ec-ae0a-455471f6aba7",
    );

    expect(shots).toHaveLength(2);
    expect(freeKickGoal).toBeDefined();
    const fk = freeKickGoal as NonNullable<typeof freeKickGoal>;
    expect(fk.context).toBe("direct-free-kick");
    expect(fk.outcome).toBe("goal");
    expect(fk.bodyPart).toBe("left-foot");
    expect(fk.xg).toBe(0.08320293);
  });

  it("maps from-corner context from play_pattern", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);
    const cornerShot = shots.find(
      (s) => s.providerEventId === "b2c3d59d-3bef-4f8a-ad86-26b69940c64e",
    );

    expect(cornerShot).toBeDefined();
    expect((cornerShot as NonNullable<typeof cornerShot>).context).toBe("from-corner");
  });

  it("maps fast-break context from From Counter play pattern", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);
    const counterShot = shots.find(
      (s) => s.providerEventId === "4a223f2d-3c3f-4655-b561-9c43a03b0f42",
    );

    expect(counterShot).toBeDefined();
    expect((counterShot as NonNullable<typeof counterShot>).context).toBe("fast-break");
  });

  it("normalizes real Bayer vs Bremen shots with correct field structure", () => {
    const info = matchInfoFromFixture(bayerVsBremen);
    const shots = fromStatsBomb.shots(bayerEventsTyped, info);

    expect(shots.length).toBeGreaterThan(0);

    for (const shot of shots) {
      expect(shot.kind).toBe("shot");
      expect(shot.provider).toBe("statsbomb");
      expect(typeof shot.xg).toBe("number");
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("maps penalty shot from Ecuador vs Senegal fixture", () => {
    const info = matchInfoFromFixture(ecuadorVsSenegal);
    const shots = fromStatsBomb.shots(ecuEventsTyped, info);

    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({
      kind: "shot",
      outcome: "goal",
      bodyPart: "right-foot",
      isPenalty: true,
      context: "penalty",
      xg: 0.7835,
      provider: "statsbomb",
    });
  });

  it("normalizes extra-time shots from Argentina vs France", () => {
    const info = matchInfoFromFixture(argentinaVsFrance);
    const shots = fromStatsBomb.shots(argEventsTyped, info);

    expect(shots.length).toBeGreaterThan(0);

    for (const shot of shots) {
      expect(shot.period).toBeGreaterThanOrEqual(1);
      expect(shot.period).toBeLessThanOrEqual(4);
    }
  });

  it("sets id as matchId:eventId", () => {
    const shots = fromStatsBomb.shots(sampleEventsTyped, matchInfo);

    expect((shots[0] as (typeof shots)[0]).id).toBe(
      "3895302:c577e730-b9f5-44f2-9257-9e7730c23d7b",
    );
  });

  it("returns empty array for empty input", () => {
    expect(fromStatsBomb.shots([], matchInfo)).toEqual([]);
  });

  it("drops events without location", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { location: _loc, ...rest } = sampleEventsTyped[0] as StatsBombEvent;
    const noLocEvent: StatsBombEvent = { ...rest, id: "no-loc-event" };
    const shots = fromStatsBomb.shots([noLocEvent], matchInfo);
    expect(shots).toEqual([]);
  });
});
