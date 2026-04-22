import { describe, expect, it } from "vitest";
import formationPositions from "../../src/compute/formation-positions.json";
import {
  OPTA_FORMATION_ID_MAP,
  optaFormationIdToKey,
} from "../../src/compute/formation-opta-ids";
import {
  parseFormationKey,
  isValidFormationKey,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
  layoutSingleTeam,
  layoutDualTeam,
  deriveFormationLabel,
  type FormationKey,
  type FormationPlayer,
  type FormationTeamData,
  type RenderedFormationSlot,
} from "../../src/compute/formation";

describe("formation-positions.json (generated)", () => {
  it("contains exactly 68 formations", () => {
    expect(Object.keys(formationPositions).length).toBe(68);
  });

  it("has between 9 and 11 positions per formation", () => {
    // mplsoccer includes 15 historical/partial formations with fewer than 11
    // players (e.g., '44' has 9, '342' has 10). Campos preserves them as-is
    // because it's a position-mapping concern, not a logical one. Adapters
    // enforce 11-player validity at their layer.
    for (const [name, slots] of Object.entries(formationPositions)) {
      expect(slots.length, `formation ${name}`).toBeGreaterThanOrEqual(9);
      expect(slots.length, `formation ${name}`).toBeLessThanOrEqual(11);
    }
  });

  it("has the expected 53 eleven-player formations (modern shapes)", () => {
    const elevenPlayerCount = Object.values(formationPositions).filter(
      (slots) => slots.length === 11,
    ).length;
    expect(elevenPlayerCount).toBe(53);
  });

  it("has the expected 15 historical/partial formations", () => {
    const partialCount = Object.values(formationPositions).filter(
      (slots) => slots.length < 11,
    ).length;
    expect(partialCount).toBe(15);
  });

  it("slots are 1-indexed and contiguous from 1 to N (where N = positions.length)", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      const indices = slots.map((s) => s.slot).sort((a, b) => a - b);
      const expected = Array.from({ length: slots.length }, (_, i) => i + 1);
      expect(indices, `formation ${name}`).toEqual(expected);
    }
  });

  it("all coordinates are within 0..100", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      for (const slot of slots) {
        expect(slot.x, `${name} slot ${slot.slot} x`).toBeGreaterThanOrEqual(0);
        expect(slot.x, `${name} slot ${slot.slot} x`).toBeLessThanOrEqual(100);
        expect(slot.y, `${name} slot ${slot.slot} y`).toBeGreaterThanOrEqual(0);
        expect(slot.y, `${name} slot ${slot.slot} y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("includes the common modern formations", () => {
    const required = ["433", "442", "4231", "352", "343", "532", "4141", "4321"];
    for (const key of required) {
      expect(formationPositions, `missing formation key: ${key}`).toHaveProperty(key);
    }
  });

  it("each slot has a non-empty position code", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      for (const slot of slots) {
        expect(slot.code, `${name} slot ${slot.slot}`).toBeTruthy();
        expect(typeof slot.code, `${name} slot ${slot.slot}`).toBe("string");
      }
    }
  });

  it("GK (slot 1) is always present with code 'GK'", () => {
    for (const [name, slots] of Object.entries(formationPositions)) {
      const first = slots[0];
      expect(first, name).toBeDefined();
      expect(first?.slot, name).toBe(1);
      expect(first?.code, `${name} slot 1 code`).toBe("GK");
    }
  });

  it("places GK at low x and forward at high x (attacking direction sanity)", () => {
    // Axis-flip regression: if a future mplsoccer upgrade or coord-conversion
    // bug mirrors the x-axis, the GK and forward swap. This test locks in the
    // attacking-direction semantic: Campos x=0 is own goal, x=100 is opposition.
    const referenceFormations: Array<[string, string, string]> = [
      // [formationKey, gkPositionCode, forwardPositionCode]
      ["433", "GK", "ST"],
      ["442", "GK", "RCF"],
      ["4231", "GK", "ST"],
    ];
    for (const [key, gkCode, forwardCode] of referenceFormations) {
      const positions = (
        formationPositions as Record<
          string,
          Array<{ slot: number; code: string; x: number; y: number }>
        >
      )[key];
      expect(positions, `formation ${key}`).toBeDefined();
      const gk = positions?.find((p) => p.code === gkCode);
      const forward = positions?.find((p) => p.code === forwardCode);
      expect(gk, `${key} ${gkCode}`).toBeDefined();
      expect(forward, `${key} ${forwardCode}`).toBeDefined();
      expect(gk!.x, `${key} ${gkCode} should be near own goal (x < 20)`).toBeLessThan(20);
      expect(
        forward!.x,
        `${key} ${forwardCode} should be near opposition goal (x > 80)`,
      ).toBeGreaterThan(80);
    }
  });
});

describe("OPTA_FORMATION_ID_MAP", () => {
  it("has exactly 24 entries", () => {
    expect(Object.keys(OPTA_FORMATION_ID_MAP).length).toBe(24);
  });

  it("maps known Opta formation IDs to mplsoccer keys", () => {
    expect(OPTA_FORMATION_ID_MAP[2]).toBe("442");
    expect(OPTA_FORMATION_ID_MAP[4]).toBe("433");
    expect(OPTA_FORMATION_ID_MAP[8]).toBe("4231");
    expect(OPTA_FORMATION_ID_MAP[10]).toBe("532");
    expect(OPTA_FORMATION_ID_MAP[12]).toBe("352");
    expect(OPTA_FORMATION_ID_MAP[13]).toBe("343");
  });

  it("every mapped key exists in the mplsoccer position table", () => {
    const positions = formationPositions as Record<string, unknown>;
    for (const [optaId, formationKey] of Object.entries(OPTA_FORMATION_ID_MAP)) {
      expect(positions, `opta id ${optaId} → ${formationKey}`).toHaveProperty(
        formationKey,
      );
    }
  });
});

describe("optaFormationIdToKey", () => {
  it("accepts numeric strings from Opta qualifier 130", () => {
    expect(optaFormationIdToKey("8")).toBe("4231");
    expect(optaFormationIdToKey("4")).toBe("433");
  });

  it("accepts numbers", () => {
    expect(optaFormationIdToKey(8)).toBe("4231");
  });

  it("throws on unknown IDs with an explicit message", () => {
    expect(() => optaFormationIdToKey(999)).toThrow(/unknown Opta formation ID: 999/);
  });

  it("throws on non-numeric strings", () => {
    expect(() => optaFormationIdToKey("abc")).toThrow(/invalid Opta formation ID/);
  });
});

describe("parseFormationKey", () => {
  it("accepts hyphenated strings", () => {
    expect(parseFormationKey("4-3-3")).toBe("433");
    expect(parseFormationKey("4-2-3-1")).toBe("4231");
    expect(parseFormationKey("3-5-2")).toBe("352");
  });

  it("accepts non-hyphenated strings", () => {
    expect(parseFormationKey("433")).toBe("433");
    expect(parseFormationKey("4231")).toBe("4231");
  });

  it("is case-insensitive for named formations", () => {
    expect(parseFormationKey("PYRAMID")).toBe("pyramid");
    expect(parseFormationKey("Metodo")).toBe("metodo");
  });

  it("strips whitespace", () => {
    expect(parseFormationKey(" 4-3-3 ")).toBe("433");
  });

  it("throws on unknown formation keys", () => {
    expect(() => parseFormationKey("4-3-4")).toThrow(/unknown formation: 434/);
    expect(() => parseFormationKey("123")).toThrow(/unknown formation/);
  });

  it("throws on empty or non-string input", () => {
    expect(() => parseFormationKey("")).toThrow(/empty formation/);
    // @ts-expect-error testing invalid input
    expect(() => parseFormationKey(null)).toThrow();
  });

  it("error messages list some of the valid formations", () => {
    try {
      parseFormationKey("4-3-4");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("433");
      expect(message).toContain("442");
    }
  });
});

describe("isValidFormationKey", () => {
  it("returns true for known keys", () => {
    expect(isValidFormationKey("433")).toBe(true);
    expect(isValidFormationKey("4231")).toBe(true);
  });

  it("returns false for unknown keys", () => {
    expect(isValidFormationKey("999")).toBe(false);
    expect(isValidFormationKey("foo")).toBe(false);
  });
});

// Ensure the types are referenced so unused-import lint rules don't fire.
// These are compile-time checks only — no runtime assertions needed.
describe("formation type exports (compile-time smoke check)", () => {
  it("exposes FormationKey, FormationPlayer, FormationTeamData", () => {
    const key: FormationKey = parseFormationKey("433");
    const player: FormationPlayer = { slot: 1, label: "Alisson" };
    const team: FormationTeamData = {
      formation: key,
      players: [player],
    };
    expect(team.formation).toBe("433");
    expect(team.players.length).toBe(1);
  });
});

describe("getFormationPositions", () => {
  it("returns 11 positions for a valid key", () => {
    const positions = getFormationPositions("433");
    expect(positions).toHaveLength(11);
  });

  it("each position has slot, code, x, y", () => {
    const positions = getFormationPositions("4231");
    for (const pos of positions) {
      expect(pos).toHaveProperty("slot");
      expect(pos).toHaveProperty("code");
      expect(pos).toHaveProperty("x");
      expect(pos).toHaveProperty("y");
      expect(typeof pos.slot).toBe("number");
      expect(typeof pos.code).toBe("string");
      expect(typeof pos.x).toBe("number");
      expect(typeof pos.y).toBe("number");
    }
  });

  it("slot 1 is always the goalkeeper", () => {
    for (const key of ["433", "442", "4231", "352"]) {
      const positions = getFormationPositions(key);
      expect(positions[0]?.slot).toBe(1);
      expect(positions[0]?.code).toBe("GK");
    }
  });

  it("throws on unknown formation key", () => {
    expect(() => getFormationPositions("999")).toThrow(/unknown formation/);
  });

  it("returns immutable data (does not mutate underlying JSON)", () => {
    const positions = getFormationPositions("433");
    expect(() => {
      (positions as unknown as { x: number }[])[0]!.x = -1;
    }).toThrow();
  });
});

describe("getMplSlotForOptaSlot", () => {
  it("maps Opta 4-2-3-1 slot 4 to mplsoccer LDM (slot 7)", () => {
    // Regression guard: kloppy's formation_mapping.py incorrectly labels
    // Opta slot 4 as RCM in 4-2-3-1. mplsoccer (and real match data from
    // Liverpool 2025-08-15) confirm it is LDM — the left holding midfielder.
    // Campos uses mplsoccer as the authoritative source.
    const mplSlot = getMplSlotForOptaSlot("4231", 4);
    expect(mplSlot).toBe(7);
    const position = getFormationSlot("4231", mplSlot as number);
    expect(position.code).toBe("LDM");
  });

  it("maps Opta 4-2-3-1 slot 8 to mplsoccer RDM (slot 6)", () => {
    const mplSlot = getMplSlotForOptaSlot("4231", 8);
    expect(mplSlot).toBe(6);
    expect(getFormationSlot("4231", mplSlot as number).code).toBe("RDM");
  });

  it("maps Opta 4-4-2 slot 4 to mplsoccer RCM (slot 7)", () => {
    // 4-4-2 and 4-2-3-1 use different conventions — Opta slot 4 flips
    // between RCM and LDM depending on the formation. Verify 4-4-2
    // stays put so we don't "fix" one and break the other.
    const mplSlot = getMplSlotForOptaSlot("442", 4);
    expect(mplSlot).toBe(7);
    expect(getFormationSlot("442", mplSlot as number).code).toBe("RCM");
  });

  it("maps GK to slot 1 in every Opta-supported formation", () => {
    // Every Opta formation has Opta slot 1 = mplsoccer slot 1 = GK.
    // A breakage here would mean the generator regressed or mplsoccer
    // changed its slot convention upstream.
    const optaKeys = Array.from(new Set(Object.values(OPTA_FORMATION_ID_MAP)));
    for (const key of optaKeys) {
      const mplSlot = getMplSlotForOptaSlot(key, 1);
      expect(mplSlot, `formation ${key}`).toBe(1);
      expect(getFormationSlot(key, 1).code).toBe("GK");
    }
  });

  it("returns null for an unknown formation key", () => {
    expect(getMplSlotForOptaSlot("not-a-formation", 1)).toBeNull();
  });

  it("returns null when the Opta slot is out of range for that formation", () => {
    // 4-2-3-1 has Opta slots 1-11; anything outside should return null.
    expect(getMplSlotForOptaSlot("4231", 12)).toBeNull();
    expect(getMplSlotForOptaSlot("4231", 0)).toBeNull();
  });

  it("covers all 24 Opta formations with a complete 1..11 mapping", () => {
    // Every formation Opta can emit must round-trip 1..11 to distinct
    // mplsoccer slots. Catches gaps if mplsoccer adds a formation but
    // forgets to annotate every slot with `opta=N`.
    const optaKeys = Array.from(new Set(Object.values(OPTA_FORMATION_ID_MAP)));
    for (const key of optaKeys) {
      const mplSlots = new Set<number>();
      for (let optaSlot = 1; optaSlot <= 11; optaSlot += 1) {
        const mplSlot = getMplSlotForOptaSlot(key, optaSlot);
        expect(mplSlot, `formation ${key} opta slot ${optaSlot}`).not.toBeNull();
        mplSlots.add(mplSlot as number);
      }
      expect(mplSlots.size, `formation ${key} unique mpl slots`).toBe(11);
    }
  });
});

describe("getFormationSlot", () => {
  it("returns the slot for a valid (formation, slotNumber) pair", () => {
    const slot = getFormationSlot("433", 1);
    expect(slot.slot).toBe(1);
    expect(slot.code).toBe("GK");
  });

  it("accepts slot numbers 1-11 on an 11-player formation", () => {
    for (let n = 1; n <= 11; n += 1) {
      expect(() => getFormationSlot("442", n)).not.toThrow();
    }
  });

  it("accepts slot numbers 1-9 on a 9-player historical formation ('44')", () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(() => getFormationSlot("44", n)).not.toThrow();
    }
  });

  it("throws on slot 10 in a 9-player formation ('44')", () => {
    expect(() => getFormationSlot("44", 10)).toThrow(/slot must be between 1 and 9/);
  });

  it("throws on slot 0 (0-indexed, not 1-indexed)", () => {
    expect(() => getFormationSlot("442", 0)).toThrow(/slot must be between 1 and 11/);
  });

  it("throws on slot 12 in an 11-player formation", () => {
    expect(() => getFormationSlot("442", 12)).toThrow(/slot must be between 1 and 11/);
  });

  it("throws on unknown formation", () => {
    expect(() => getFormationSlot("999", 1)).toThrow(/unknown formation/);
  });
});

describe("layoutSingleTeam", () => {
  it("returns 11 rendered slots for a zero-config 4-3-3 call", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots).toHaveLength(11);
  });

  it("assigns players to slots by array order", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [
          { label: "Raya", number: 1 },
          { label: "White", number: 2 },
        ],
      },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots[0]?.player?.label).toBe("Raya");
    expect(result.slots[1]?.player?.label).toBe("White");
  });

  it("fills remaining slots with placeholders when fewer than 11 players", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "GK only", number: 1 }],
      },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots).toHaveLength(11);
    expect(result.slots[0]?.player?.label).toBe("GK only");
    expect(result.slots[0]?.placeholder).toBe(false);
    expect(result.slots[1]?.placeholder).toBe(true);
    expect(result.slots[1]?.player).toBeUndefined();
  });

  it("respects explicit slot override", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [
          { label: "ST", number: 9, slot: 11 },
          { label: "GK", number: 1, slot: 1 },
        ],
      },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots[0]?.player?.label).toBe("GK");
    expect(result.slots[10]?.player?.label).toBe("ST");
  });

  it("throws when more than 11 players supplied to an 11-slot formation", () => {
    const players = Array.from({ length: 12 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    expect(() =>
      layoutSingleTeam(
        { formation: "433", players },
        { attackingDirection: "up", crop: "full" },
      ),
    ).toThrow(/at most 11 players allowed in formation 433/);
  });

  it("throws on 10 players in the 9-slot historical formation '44'", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    expect(() =>
      layoutSingleTeam(
        { formation: "44", players },
        { attackingDirection: "up", crop: "full" },
      ),
    ).toThrow(/at most 9 players allowed in formation 44/);
  });

  it("fills 9 slots cleanly when '44' receives exactly 9 players", () => {
    const players = Array.from({ length: 9 }, (_, i) => ({
      label: `p${i}`,
      number: i + 1,
    }));
    const result = layoutSingleTeam(
      { formation: "44", players },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots).toHaveLength(9);
    expect(result.slots.every((s) => !s.placeholder)).toBe(true);
    expect(result.slots.every((s) => s.player !== undefined)).toBe(true);
  });

  it("rejects explicit slot 10 in a 9-slot formation '44'", () => {
    expect(() =>
      layoutSingleTeam(
        {
          formation: "44",
          players: [{ label: "X", slot: 10 }],
        },
        { attackingDirection: "up", crop: "full" },
      ),
    ).toThrow(/player slot must be an integer between 1 and 9 in formation 44/);
  });

  it("places GK at low x in vertical orientation (attacking-axis invariant)", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "full" },
    );
    const gkSlot = result.slots.find((s) => s.positionCode === "GK");
    expect(gkSlot).toBeDefined();
    // In Campos coords x is the attacking axis (x=0 own goal, x=100 opposition)
    // regardless of orientation. The stadia Pitch projection handles the
    // vertical/horizontal view transform, so layout data is orientation-invariant.
    expect(gkSlot!.x).toBeLessThan(20);
  });

  it("places GK at low x in horizontal orientation (attacking-axis invariant)", () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "right", crop: "full" },
    );
    const gkSlot = result.slots.find((s) => s.positionCode === "GK");
    expect(gkSlot).toBeDefined();
    expect(gkSlot!.x).toBeLessThan(20);
  });

  it("returns the same coordinates for vertical and horizontal orientations", () => {
    // Regression guard: the projection handles the visual rotation. If layout
    // ever starts rotating again, this test will catch it immediately.
    const v = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "full" },
    );
    const h = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "right", crop: "full" },
    );
    for (let i = 0; i < v.slots.length; i += 1) {
      expect(v.slots[i]?.x, `slot ${i} x`).toBe(h.slots[i]?.x);
      expect(v.slots[i]?.y, `slot ${i} y`).toBe(h.slots[i]?.y);
    }
  });

  it('half crop side="defend" compresses the team into the defensive half', () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "half", side: "defend" },
    );
    const gk = result.slots.find((s) => s.positionCode === "GK");
    const striker = result.slots.find((s) => s.positionCode === "ST");
    expect(gk?.x).toBeLessThan(10);
    expect(striker?.x).toBeGreaterThan(40);
    expect(result.slots.every((s) => s.x >= 0 && s.x <= 50)).toBe(true);
  });

  it('half crop side="attack" with flip compresses the goalkeeper into the attacking box', () => {
    const result = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "right", crop: "half", side: "attack", flip: true },
    );
    const gk = result.slots.find((s) => s.positionCode === "GK");
    const striker = result.slots.find((s) => s.positionCode === "ST");
    expect(gk?.x).toBeGreaterThan(90);
    expect(striker?.x).toBeLessThan(60);
    expect(result.slots.every((s) => s.x >= 50 && s.x <= 100)).toBe(true);
  });

  it("flip on a full pitch mirrors the formation across the attacking axis", () => {
    const regular = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "full" },
    );
    const flipped = layoutSingleTeam(
      { formation: "433", players: [] },
      { attackingDirection: "up", crop: "full", flip: true },
    );
    const regularGk = regular.slots.find((s) => s.positionCode === "GK");
    const flippedGk = flipped.slots.find((s) => s.positionCode === "GK");
    expect(regularGk?.x).toBeLessThan(20);
    expect(flippedGk?.x).toBeGreaterThan(80);
  });

  it("populates positionCode from the formation table when not on the player", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "keeper", number: 1 }],
      },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots[0]?.positionCode).toBe("GK");
  });

  it("preserves explicit positionCode on a player", () => {
    const result = layoutSingleTeam(
      {
        formation: "433",
        players: [{ label: "keeper", number: 1, positionCode: "SWEEPER" }],
      },
      { attackingDirection: "up", crop: "full" },
    );
    expect(result.slots[0]?.positionCode).toBe("SWEEPER");
  });
});

describe("layoutDualTeam", () => {
  it("returns slots for both teams", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "4231", players: [] },
    );
    expect(result.home.slots).toHaveLength(11);
    expect(result.away.slots).toHaveLength(11);
  });

  it("home slots all occupy the defensive half (x < 50)", () => {
    // Campos x is the attacking axis; in dual-team mode home occupies the
    // defensive half (x < 50), which on a vertical pitch renders as the
    // bottom of the screen.
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.home.slots) {
      expect(slot.x, `home slot ${slot.slot}`).toBeLessThan(50);
    }
  });

  it("away slots all occupy the attacking half (x > 50)", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.away.slots) {
      expect(slot.x, `away slot ${slot.slot}`).toBeGreaterThan(50);
    }
  });

  it("home GK is at the bottom of the pitch (low x)", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    const homeGk = result.home.slots.find((s) => s.positionCode === "GK");
    expect(homeGk).toBeDefined();
    expect(homeGk!.x).toBeLessThan(15);
  });

  it("away GK is at the top of the pitch (high x)", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    const awayGk = result.away.slots.find((s) => s.positionCode === "GK");
    expect(awayGk).toBeDefined();
    expect(awayGk!.x).toBeGreaterThan(85);
  });

  it("both teams use the full pitch width (y) for lateral spacing", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.home.slots) {
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(100);
    }
    for (const slot of result.away.slots) {
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(100);
    }
  });

  it("supports mixed formations independently", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "4231", players: [] },
    );
    expect(result.home.slots).toHaveLength(11);
    expect(result.away.slots).toHaveLength(11);
    const homeGk = result.home.slots.find((s) => s.slot === 1);
    const awayGk = result.away.slots.find((s) => s.slot === 1);
    expect(homeGk?.positionCode).toBe("GK");
    expect(awayGk?.positionCode).toBe("GK");
  });

  it("assigns home players by array order", () => {
    const result = layoutDualTeam(
      {
        formation: "433",
        players: [{ label: "home-gk", number: 1 }],
      },
      { formation: "433", players: [] },
    );
    const homeGk = result.home.slots.find((s) => s.positionCode === "GK");
    expect(homeGk?.player?.label).toBe("home-gk");
  });

  it("assigns away players by array order", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      {
        formation: "433",
        players: [{ label: "away-gk", number: 1 }],
      },
    );
    const awayGk = result.away.slots.find((s) => s.positionCode === "GK");
    expect(awayGk?.player?.label).toBe("away-gk");
  });

  it("assigns home and away players independently without cross-contamination", () => {
    const result = layoutDualTeam(
      {
        formation: "433",
        players: [{ label: "home-gk", number: 1 }],
      },
      {
        formation: "4231",
        players: [{ label: "away-gk", number: 1 }],
      },
    );
    const homeGk = result.home.slots.find((s) => s.positionCode === "GK");
    const awayGk = result.away.slots.find((s) => s.positionCode === "GK");
    expect(homeGk?.player?.label).toBe("home-gk");
    expect(awayGk?.player?.label).toBe("away-gk");
    // No cross-contamination: away GK is not the home one
    expect(homeGk?.player?.label).not.toBe(awayGk?.player?.label);
  });

  it("leaves placeholder slots when players are omitted", () => {
    const result = layoutDualTeam(
      { formation: "433", players: [] },
      { formation: "433", players: [] },
    );
    for (const slot of result.home.slots) {
      expect(slot.placeholder).toBe(true);
      expect(slot.player).toBeUndefined();
    }
    for (const slot of result.away.slots) {
      expect(slot.placeholder).toBe(true);
      expect(slot.player).toBeUndefined();
    }
  });

  it("throws when home exceeds the formation's slot count with formation-specific message", () => {
    const tooMany = Array.from({ length: 12 }, (_, i) => ({ label: `p${i}` }));
    expect(() =>
      layoutDualTeam(
        { formation: "433", players: tooMany },
        { formation: "433", players: [] },
      ),
    ).toThrow(/at most 11 players allowed in formation 433/);
  });

  it("throws when away exceeds the formation's slot count with formation-specific message", () => {
    const tooMany = Array.from({ length: 12 }, (_, i) => ({ label: `p${i}` }));
    expect(() =>
      layoutDualTeam(
        { formation: "433", players: [] },
        { formation: "4231", players: tooMany },
      ),
    ).toThrow(/at most 11 players allowed in formation 4231/);
  });

  it("honours variable-slot formations — '44' has 9 slots per team", () => {
    const result = layoutDualTeam(
      { formation: "44", players: [] },
      { formation: "44", players: [] },
    );
    expect(result.home.slots).toHaveLength(9);
    expect(result.away.slots).toHaveLength(9);
  });

  it("throws the 9-slot error message for an overflow in a '44' formation", () => {
    const tenPlayers = Array.from({ length: 10 }, (_, i) => ({ label: `p${i}` }));
    expect(() =>
      layoutDualTeam(
        { formation: "44", players: tenPlayers },
        { formation: "44", players: [] },
      ),
    ).toThrow(/at most 9 players allowed in formation 44/);
  });
});

describe("deriveFormationLabel", () => {
  const gkSlot: RenderedFormationSlot = {
    slot: 1,
    positionCode: "GK",
    x: 10,
    y: 50,
    placeholder: false,
  };

  // ----- auto strategy: 4 branches -----

  it("auto: returns position code when no player is assigned", () => {
    const label = deriveFormationLabel({ slot: gkSlot, strategy: "auto" });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBeUndefined();
  });

  it("auto: returns number in marker and name below when player has both", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "auto",
    });
    expect(label.primary).toBe("1");
    expect(label.secondary).toBe("Raya");
  });

  it("auto: returns initials in marker and full name below when only name is present", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "David Raya Martin" } },
      strategy: "auto",
    });
    expect(label.primary).toMatch(/^[A-Z]+$/);
    expect(label.secondary).toBe("David Raya Martin");
  });

  it("auto: falls back to position code when player has neither number nor label", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: {} },
      strategy: "auto",
    });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBeUndefined();
  });

  // ----- explicit strategies: force the expected source -----

  it("honors explicit 'positionCode' strategy and keeps the name as secondary", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "positionCode",
    });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBe("Raya");
  });

  it("honors explicit 'jerseyNumber' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya", number: 1 } },
      strategy: "jerseyNumber",
    });
    expect(label.primary).toBe("1");
    expect(label.secondary).toBe("Raya");
  });

  it("honors explicit 'initials' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Bukayo Saka" } },
      strategy: "initials",
    });
    expect(label.primary).toMatch(/BS/);
    expect(label.secondary).toBe("Bukayo Saka");
  });

  it("honors explicit 'name' strategy", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Saka" } },
      strategy: "name",
    });
    expect(label.primary).toBe("Saka");
    expect(label.secondary).toBeUndefined();
  });

  // ----- fallback behavior when the requested source is missing -----

  it("jerseyNumber falls back to position code when no player is assigned", () => {
    const label = deriveFormationLabel({ slot: gkSlot, strategy: "jerseyNumber" });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBeUndefined();
  });

  it("jerseyNumber falls back to position code when player has no number", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { label: "Raya" } },
      strategy: "jerseyNumber",
    });
    expect(label.primary).toBe("GK");
  });

  it("initials falls back to position code when no name is available", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { number: 1 } },
      strategy: "initials",
    });
    expect(label.primary).toBe("GK");
  });

  it("name falls back to position code when no name is available", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { number: 1 } },
      strategy: "name",
    });
    expect(label.primary).toBe("GK");
  });

  it("positionCode omits secondary when no player label is present", () => {
    const label = deriveFormationLabel({
      slot: { ...gkSlot, player: { number: 1 } },
      strategy: "positionCode",
    });
    expect(label.primary).toBe("GK");
    expect(label.secondary).toBeUndefined();
  });
});
