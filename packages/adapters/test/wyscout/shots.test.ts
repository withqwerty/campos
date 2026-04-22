import { describe, expect, it } from "vitest";

import { fromWyscout } from "../../src/index";
import type { WyscoutMatchData } from "../../src/index";

import arsenalVsSouthampton from "../fixtures/wyscout/raw-match-arsenal-v-southampton.json";

const matchData = arsenalVsSouthampton as unknown as WyscoutMatchData;

function getRequiredShot(shots: ReturnType<typeof fromWyscout.shots>, index: number) {
  const shot = shots[index];
  expect(shot).toBeDefined();
  if (!shot) {
    throw new Error(`Expected Wyscout shot at index ${index}`);
  }
  return shot;
}

describe("fromWyscout.shots", () => {
  it("normalizes raw Wyscout shot events into Campos shot entities", () => {
    const shots = fromWyscout.shots(matchData);

    expect(shots).toHaveLength(25);
    expect(shots[0]).toMatchObject({
      kind: "shot",
      provider: "wyscout",
      providerEventId: "241083997",
      teamId: "1619",
      playerId: "8144",
      playerName: null,
      outcome: "saved",
      bodyPart: "left-foot",
      context: "regular-play",
    });
  });

  it("uses the fixture match id by default", () => {
    const shots = fromWyscout.shots(matchData);
    const firstShot = getRequiredShot(shots, 0);
    expect(firstShot.id).toBe("2500040:241083997");
    expect(firstShot.matchId).toBe("2500040");
  });

  it("allows matchId override via matchInfo", () => {
    const shots = fromWyscout.shots(matchData, { matchId: "custom-match-id" });
    const firstShot = getRequiredShot(shots, 0);
    expect(firstShot.id).toBe("custom-match-id:241083997");
    expect(firstShot.matchId).toBe("custom-match-id");
  });

  it("normalizes coordinates into Campos 0-100 space and flips the y-axis", () => {
    const shots = fromWyscout.shots(matchData);
    const firstShot = getRequiredShot(shots, 0);

    expect(firstShot.x).toBe(87);
    expect(firstShot.y).toBe(60);
    // Second Wyscout position is the shot target (e.g. goal line); mapped to endX/endY.
    expect(firstShot.endX).toBe(100);
    expect(firstShot.endY).toBe(0);

    for (const shot of shots) {
      expect(shot.x).toBeGreaterThanOrEqual(0);
      expect(shot.x).toBeLessThanOrEqual(100);
      expect(shot.y).toBeGreaterThanOrEqual(0);
      expect(shot.y).toBeLessThanOrEqual(100);
    }
  });

  it("maps direct free kicks as direct-free-kick context", () => {
    const shots = fromWyscout.shots(matchData);
    const freeKickShot = shots.find((shot) => shot.providerEventId === "241084564");

    expect(freeKickShot).toBeDefined();
    if (!freeKickShot) {
      throw new Error("Expected direct free-kick shot");
    }
    expect(freeKickShot.context).toBe("direct-free-kick");
    expect(freeKickShot.outcome).toBe("off-target");
    expect(freeKickShot.bodyPart).toBe("left-foot");
  });

  it("maps goals, saved shots, blocked shots, off-target shots, and woodwork", () => {
    const shots = fromWyscout.shots(matchData);

    expect(shots.some((shot) => shot.outcome === "goal")).toBe(true);
    expect(shots.some((shot) => shot.outcome === "saved")).toBe(true);
    expect(shots.some((shot) => shot.outcome === "blocked")).toBe(true);
    expect(shots.some((shot) => shot.outcome === "off-target")).toBe(true);
    expect(shots.some((shot) => shot.outcome === "hit-woodwork")).toBe(false);
  });

  it("infers goal-mouth coordinates from Wyscout shot-zone tags", () => {
    const shots = fromWyscout.shots(matchData);
    const firstShot = getRequiredShot(shots, 0);

    expect(firstShot.goalMouthY).toBe(50);
    expect(firstShot.goalMouthZ).toBe(0);

    const topLeftFreeKick = shots.find((shot) => shot.providerEventId === "241084564");
    expect(topLeftFreeKick).toBeDefined();
    if (!topLeftFreeKick) {
      throw new Error("Expected top-left free-kick shot");
    }
    expect(topLeftFreeKick.goalMouthY).toBe(40);
    expect(topLeftFreeKick.goalMouthZ).toBe(3.5);

    const blockedShot = shots.find((shot) => shot.outcome === "blocked");
    expect(blockedShot).toBeDefined();
    if (!blockedShot) {
      throw new Error("Expected blocked shot");
    }
    expect(blockedShot.goalMouthY).toBeNull();
    expect(blockedShot.goalMouthZ).toBeNull();
  });

  it("sets xg to null because the extracted v2 fixture does not include xg", () => {
    const shots = fromWyscout.shots(matchData);
    expect(shots.every((shot) => shot.xg === null)).toBe(true);
  });

  it("includes raw tag ids and event ids in sourceMeta", () => {
    const shots = fromWyscout.shots(matchData);
    const firstShot = getRequiredShot(shots, 0);
    expect(firstShot.sourceMeta).toMatchObject({
      eventId: 10,
      subEventId: 100,
    });
    expect((firstShot.sourceMeta as { tags: number[] }).tags).toContain(1201);
  });
});
