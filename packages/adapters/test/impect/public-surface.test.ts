import { describe, expect, it } from "vitest";

import { fromImpect, type ImpectOpenDataSlice } from "../../src/index.js";

import fixture from "../fixtures/impect/raw-match-122838.json";
import richFixture from "../fixtures/impect/raw-match-122838-rich.json";

const openData = fixture as ImpectOpenDataSlice;
const richOpenData = richFixture as ImpectOpenDataSlice;

describe("fromImpect", () => {
  it("maps open-data slices into canonical match lineups", () => {
    const result = fromImpect.matchLineups(openData);

    expect(result.matchId).toBe("122838");
    expect(result.home?.teamLabel).toBe("SV Werder Bremen");
    expect(result.home?.formation).toBe("532");
    expect(
      result.home?.starters.find((player) => player.playerId === "8451"),
    ).toMatchObject({
      label: "Jiri Pavlenka",
      slot: 1,
      positionCode: "GK",
    });
    expect(result.home?.bench.find((player) => player.playerId === "5097")).toMatchObject(
      {
        substitutedIn: true,
        minuteOn: 58,
      },
    );
    expect(result.away?.teamLabel).toBe("FC Bayern München");
    expect(result.away?.formation).toBe("4231");
  });

  it("projects formation snapshots for both sides", () => {
    const home = fromImpect.formations(openData, "home");
    const away = fromImpect.formations(openData, "away");

    expect(home.formation).toBe("532");
    expect(home.players).toHaveLength(11);
    expect(home.players.find((player) => player.slot === 1)).toMatchObject({
      playerId: "8451",
      positionCode: "GK",
    });
    expect(away.formation).toBe("4231");
    expect(away.players.find((player) => player.slot === 1)).toMatchObject({
      playerId: "1202",
      positionCode: "GK",
    });
  });

  it("maps open-data events into an honest event subset", () => {
    const events = fromImpect.events(richOpenData);

    expect(events.some((event) => event.kind === "pass")).toBe(true);
    expect(events.some((event) => event.kind === "shot")).toBe(true);
    expect(events.some((event) => event.kind === "carry")).toBe(true);
    expect(events.every((event) => event.provider === "impect")).toBe(true);
  });

  it("exposes pass and shot helper surfaces from the same open-data bundle", () => {
    const passes = fromImpect.passes(richOpenData);
    const shots = fromImpect.shots(richOpenData);

    expect(passes.length).toBeGreaterThan(5);
    expect(shots.length).toBeGreaterThan(0);
    expect(passes.every((event) => event.provider === "impect")).toBe(true);
    expect(shots.every((event) => event.provider === "impect")).toBe(true);
  });

  // The first goal in this match (eventId 4858179239) is a RIGHT_WINGER's
  // close-range finish from raw Impect adjCoordinates (39.3, -5.5). In Campos
  // canonical: x ≈ 87.4 (near opposition goal), y ≈ 41.9 (attacker's right
  // half of centre, matching a right-winger's origin). Pin both so a future
  // y-inversion or scaling regression fails loudly.
  it("anchors a known goal to attacker-relative canonical coordinates", () => {
    const shots = fromImpect.shots(richOpenData);
    const goal = shots.find((shot) => shot.providerEventId === "4858179239");

    expect(goal).toBeDefined();
    expect(goal?.outcome).toBe("goal");
    expect(goal?.playerId).toBe("204");
    expect(goal?.x).toBeGreaterThan(80);
    expect(goal?.y).toBeGreaterThan(35);
    expect(goal?.y).toBeLessThan(50);
  });
});
