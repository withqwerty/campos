import { describe, expect, it } from "vitest";

import {
  buildImpectLookups,
  impectToCampos,
  mapImpectMatchLineups,
  normalizeImpectClock,
  normalizeImpectFormation,
  type ImpectLineups,
  type ImpectPlayerProfile,
  type ImpectSquad,
} from "../../src/impect/helpers.js";

import fixture from "../fixtures/impect/raw-match-122838.json";
import tacticalShiftFixture from "../fixtures/impect/raw-match-122839-tactical-shifts.json";

const lineups = fixture.lineups as ImpectLineups;
const players = fixture.players as ImpectPlayerProfile[];
const squads = fixture.squads as ImpectSquad[];

const shiftLineups = tacticalShiftFixture.lineups as ImpectLineups;
const shiftPlayers = tacticalShiftFixture.players as ImpectPlayerProfile[];
const shiftSquads = tacticalShiftFixture.squads as ImpectSquad[];

describe("impect helpers", () => {
  it("normalizes known Impect formation aliases", () => {
    expect(normalizeImpectFormation("5-1-2-2")).toBe("532");
    expect(normalizeImpectFormation("4-4-2 (diamond)")).toBe("4312");
    expect(normalizeImpectFormation("4-2-3-1")).toBe("4231");
  });

  it("builds squad and player lookups from open-data slices", () => {
    const result = buildImpectLookups(squads, players);

    expect(result.squadById.get(38)?.name).toBe("SV Werder Bremen");
    expect(result.playerById.get(231)?.commonname).toBe("Harry Kane");
  });

  it("normalizes clock and coordinates into Campos-friendly values", () => {
    expect(
      normalizeImpectClock({ gameTime: "58:34.2450", gameTimeInSec: 3514.245 }, 2),
    ).toEqual({
      minute: 58,
      second: 34,
      periodSeconds: 814,
    });
    // Without periodId the helper reports the total-match seconds so callers
    // can see the raw clock; first-half stoppage time doesn't get miscategorised
    // as second-half periodSeconds.
    expect(
      normalizeImpectClock({ gameTime: "45:30 (+0:30)", gameTimeInSec: 2760 }, 1),
    ).toEqual({
      minute: 46,
      second: 0,
      periodSeconds: 2760,
    });

    expect(impectToCampos(0, 0, true)).toEqual({ x: 50, y: 50 });
    expect(impectToCampos(52.5, 34, false)).toEqual({ x: 0, y: 0 });
  });

  it("maps open-data lineup payloads into canonical team sheets", () => {
    const result = mapImpectMatchLineups(lineups, squads, players);

    expect(result.matchId).toBe("122838");
    expect(result.home?.teamLabel).toBe("SV Werder Bremen");
    expect(result.home?.formation).toBe("532");
    expect(result.home?.starters).toHaveLength(11);
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
    expect(
      result.home?.starters.find((player) => player.playerId === "1028"),
    ).toMatchObject({
      substitutedOut: true,
      minuteOff: 58,
    });

    expect(result.away?.teamLabel).toBe("FC Bayern München");
    expect(result.away?.formation).toBe("4231");
    expect(
      result.away?.starters.find((player) => player.playerId === "1202"),
    ).toMatchObject({
      slot: 1,
      positionCode: "GK",
    });
  });

  // Werder's home 5-1-2-2 has three starting CBs where one carries
  // positionSide "CENTRE" with no left/right qualifier — the fallback in
  // assignFormationSlots should still yield three distinct slots.
  it("gives every 3-CB starter a distinct formation slot even when positionSide is CENTRE", () => {
    const result = mapImpectMatchLineups(lineups, squads, players);
    const cbStarters = (result.home?.starters ?? []).filter((player) =>
      ["CB", "RCB", "LCB"].includes(player.positionCode ?? ""),
    );

    expect(cbStarters).toHaveLength(3);
    const slots = cbStarters.map((player) => player.slot).sort();
    expect(new Set(slots).size).toBe(3);
  });

  // Leipzig's substitution stream in 122839 includes tactical shifts where
  // neither side is BANK. Player 1169 starts as ATTACKING_MIDFIELD/CENTRE_RIGHT
  // and shifts twice (minute 74 → CENTRE, minute 77 → CENTER_FORWARD/CENTRE_RIGHT)
  // before eventually being subbed off, so positionCode should reflect the
  // latest tactical snapshot rather than the starting position.
  it("applies in-play tactical shifts to positionCode rather than only tracking bank-outs", () => {
    const result = mapImpectMatchLineups(shiftLineups, shiftSquads, shiftPlayers);
    const shiftedPlayer = result.home?.starters.find(
      (player) => player.playerId === "1169",
    );

    expect(shiftedPlayer).toBeDefined();
    expect(shiftedPlayer?.positionCode).not.toBe("RW");
    expect(shiftedPlayer?.positionCode).toMatch(/^(RCF|ST)$/);
  });
});
