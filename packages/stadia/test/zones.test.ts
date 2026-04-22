import { describe, expect, it } from "vitest";

import { zoneEdgesInCampos } from "../src/zones.js";

describe("zoneEdgesInCampos", () => {
  describe('"18" layout (6 rows × 3 columns, equal divisions)', () => {
    const { xEdges, yEdges } = zoneEdgesInCampos("18");

    it("produces 6 bins along the length axis and 3 across the width", () => {
      expect(xEdges.length).toBe(7);
      expect(yEdges.length).toBe(4);
    });

    it("spans the full 0–100 Campos range", () => {
      expect(xEdges[0]).toBe(0);
      expect(xEdges[xEdges.length - 1]).toBe(100);
      expect(yEdges[0]).toBe(0);
      expect(yEdges[yEdges.length - 1]).toBe(100);
    });

    it("divides length into 6 equal thirds-of-a-third", () => {
      // Inner edges at 100/6, 2*100/6, … 5*100/6.
      expect(xEdges[1]).toBeCloseTo(100 / 6, 10);
      expect(xEdges[3]).toBeCloseTo(50, 10);
    });

    it("divides width into 3 equal thirds", () => {
      expect(yEdges[1]).toBeCloseTo(100 / 3, 10);
      expect(yEdges[2]).toBeCloseTo(200 / 3, 10);
    });
  });

  describe('"20" layout (4 rows × 5 positional columns)', () => {
    const { xEdges, yEdges } = zoneEdgesInCampos("20");

    it("produces 4 bins along the length axis (quarter divisions)", () => {
      expect(xEdges.length).toBe(5);
      expect(xEdges[1]).toBeCloseTo(25, 10);
      expect(xEdges[2]).toBeCloseTo(50, 10);
      expect(xEdges[3]).toBeCloseTo(75, 10);
    });

    it("produces 5 positional columns aligned to penalty-area edges", () => {
      // Standard penalty area = 40.32m wide; pitch width = 68m.
      // hsLeft = (68 - 40.32) / 2 = 13.84 → 20.353% of pitch width.
      expect(yEdges.length).toBe(6);
      expect(yEdges[1]).toBeCloseTo((13.84 / 68) * 100, 6);
      expect(yEdges[4]).toBeCloseTo(((68 - 13.84) / 68) * 100, 6);
    });

    it("the centre column is bounded by the half-space → penalty-area-thirds split", () => {
      // Inner PA third = 40.32 / 3 = 13.44m
      // Centre column left edge = hsLeft + paInnerThird = 13.84 + 13.44 = 27.28m
      //                         = 27.28 / 68 * 100 = 40.12%
      expect(yEdges[2]).toBeCloseTo(((13.84 + 40.32 / 3) / 68) * 100, 6);
    });
  });

  it("returns stable references (safe to reuse across renders)", () => {
    const a = zoneEdgesInCampos("20");
    const b = zoneEdgesInCampos("20");
    expect(a.xEdges).toBe(b.xEdges);
    expect(a.yEdges).toBe(b.yEdges);
  });
});
