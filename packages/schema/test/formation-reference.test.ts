import { describe, expect, it } from "vitest";

import {
  allFormationKeys,
  getFormationPositions,
  getFormationSlot,
  getMplSlotForOptaSlot,
  isValidFormationKey,
  parseFormationKey,
} from "../src/formation";
import { optaFormationIdToKey } from "../src/formation-opta-ids";

describe("schema formation reference helpers", () => {
  it("exposes the full mplsoccer formation table", () => {
    expect(allFormationKeys()).toHaveLength(68);
    expect(allFormationKeys()).toContain("433");
    expect(allFormationKeys()).toContain("4231");
  });

  it("parses and validates canonical formation keys", () => {
    expect(parseFormationKey("4-3-3")).toBe("433");
    expect(parseFormationKey("Metodo")).toBe("metodo");
    expect(isValidFormationKey("4231")).toBe(true);
    expect(isValidFormationKey("999")).toBe(false);
  });

  it("returns immutable canonical positions", () => {
    const positions = getFormationPositions("433");

    expect(positions).toHaveLength(11);
    expect(positions[0]?.code).toBe("GK");
    expect(() => {
      (positions as unknown as Array<{ x: number }>)[0]!.x = -1;
    }).toThrow();
  });

  it("maps Opta formation IDs onto known formation keys", () => {
    expect(optaFormationIdToKey("8")).toBe("4231");
    expect(optaFormationIdToKey(4)).toBe("433");
  });

  it("translates Opta slots using the shared reference seam", () => {
    const mplSlot = getMplSlotForOptaSlot("4231", 4);

    expect(mplSlot).toBe(7);
    expect(getFormationSlot("4231", mplSlot as number).code).toBe("LDM");
  });
});
