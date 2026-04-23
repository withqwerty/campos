import { describe, expect, it } from "vitest";

import {
  assignFormationSlots,
  type FormationSlotCandidate,
} from "../../src/shared/assign-formation-slots";

describe("assignFormationSlots", () => {
  it("assigns every player in a clean 4-3-3 XI to a distinct slot", () => {
    const players: FormationSlotCandidate[] = [
      { playerId: "1", candidateCodes: ["GK"] },
      { playerId: "2", candidateCodes: ["RB"] },
      { playerId: "3", candidateCodes: ["RCB"] },
      { playerId: "4", candidateCodes: ["LCB"] },
      { playerId: "5", candidateCodes: ["LB"] },
      { playerId: "6", candidateCodes: ["RCM"] },
      { playerId: "7", candidateCodes: ["CDM"] },
      { playerId: "8", candidateCodes: ["LCM"] },
      { playerId: "9", candidateCodes: ["RW"] },
      { playerId: "10", candidateCodes: ["ST"] },
      { playerId: "11", candidateCodes: ["LW"] },
    ];

    const assignments = assignFormationSlots("433", players);

    expect(assignments.size).toBe(11);
    const slots = Array.from(assignments.values()).map((a) => a.slot);
    // Every slot is distinct
    expect(new Set(slots).size).toBe(11);
    for (const slot of slots) {
      expect(slot).not.toBeUndefined();
    }
  });

  it("awards the contested slot to the more constrained player (fewer candidate codes)", () => {
    // Two players both list "LCM" as a candidate. Player A has only that
    // option; player B has two options. With the ordering rule (fewer
    // candidates first), A wins "LCM" and B falls back to their other slot.
    const players: FormationSlotCandidate[] = [
      { playerId: "A", candidateCodes: ["LCM"] },
      { playerId: "B", candidateCodes: ["LCM", "RCM"] },
    ];

    const assignments = assignFormationSlots("433", players);
    const a = assignments.get("A");
    const b = assignments.get("B");

    expect(a?.positionCode).toBe("LCM");
    expect(b?.positionCode).toBe("RCM");
    expect(a?.slot).not.toBe(b?.slot);
  });

  it("falls back to the first unclaimed formation slot for unknown provider codes", () => {
    // GK and one outfield player with a bogus code. Outfield player should
    // still receive a slot (not be left slot-less) because projection needs
    // a complete XI.
    const players: FormationSlotCandidate[] = [
      { playerId: "1", candidateCodes: ["GK"] },
      { playerId: "99", candidateCodes: ["INVALID"] },
    ];

    const assignments = assignFormationSlots("433", players);
    const unknown = assignments.get("99");

    expect(unknown?.slot).toBeDefined();
    expect(unknown?.positionCode).toBe("INVALID");
  });

  it("uses numeric tiebreak so '2' claims the contested slot before '10'", () => {
    // Two players competing for the same single slot with equal candidate
    // counts. Tiebreak is numeric-aware player-id compare.
    const players: FormationSlotCandidate[] = [
      { playerId: "10", candidateCodes: ["GK"] },
      { playerId: "2", candidateCodes: ["GK"] },
    ];

    const assignments = assignFormationSlots("433", players);
    const two = assignments.get("2");
    const ten = assignments.get("10");

    // Player "2" claims the GK slot (matches code → slot.code survives).
    expect(two?.positionCode).toBe("GK");
    // Player "10" gets a fallback slot (GK already used). Assignments keep
    // the preferred code in positionCode, but the slot number differs.
    expect(ten?.slot).toBeDefined();
    expect(ten?.slot).not.toBe(two?.slot);
  });

  it("returns an empty map for an empty player list", () => {
    const assignments = assignFormationSlots("433", []);
    expect(assignments.size).toBe(0);
  });

  it("still assigns fallback codes even when formation slots run out", () => {
    // 12 players into a 11-slot formation: the extra one should still be in
    // the map, with its candidate code preserved, but no slot.
    const players: FormationSlotCandidate[] = Array.from({ length: 12 }, (_, i) => ({
      playerId: `p${i + 1}`,
      candidateCodes: ["GK"],
    }));

    const assignments = assignFormationSlots("433", players);

    expect(assignments.size).toBe(12);
    const withoutSlot = Array.from(assignments.values()).filter(
      (a) => a.slot === undefined,
    );
    expect(withoutSlot).toHaveLength(1);
    // The slot-less player still carries its fallback code.
    expect(withoutSlot[0]?.positionCode).toBe("GK");
  });

  it("never double-assigns a slot when multiple players prefer the same position", () => {
    const players: FormationSlotCandidate[] = [
      { playerId: "1", candidateCodes: ["GK"] },
      { playerId: "2", candidateCodes: ["GK"] },
      { playerId: "3", candidateCodes: ["GK"] },
    ];

    const assignments = assignFormationSlots("433", players);
    const assignedSlots = Array.from(assignments.values())
      .map((a) => a.slot)
      .filter((slot): slot is number => slot !== undefined);

    // Every assigned slot is distinct — no slot is claimed twice.
    expect(new Set(assignedSlots).size).toBe(assignedSlots.length);
    // All three players still receive an assignment.
    expect(assignments.size).toBe(3);
  });
});
