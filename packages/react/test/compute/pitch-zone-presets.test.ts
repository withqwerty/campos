import { describe, expect, it } from "vitest";

import {
  ZONE_PRESET_EXPLICIT_EDGES_WARNING,
  resolvePitchZonePresetEdges,
  zonePresetFullPitchOnlyWarning,
  zonePresetGridOverrideWarning,
} from "../../src/compute/pitch-zone-presets";

describe("resolvePitchZonePresetEdges — uniform presets", () => {
  it("returns 4 edges for the 3x3 full-pitch preset, anchored at 0 and 100", () => {
    const result = resolvePitchZonePresetEdges("3x3", "full");
    if (result.xEdges === undefined) throw new Error("expected edges");

    expect(result.xEdges).toHaveLength(4);
    expect(result.xEdges[0]).toBe(0);
    expect(result.xEdges[3]).toBe(100);
    expect(result.xEdges[1]).toBeCloseTo(100 / 3, 10);
    expect(result.xEdges[2]).toBeCloseTo(200 / 3, 10);

    expect(result.yEdges).toHaveLength(4);
    expect(result.yEdges[0]).toBe(0);
    expect(result.yEdges[3]).toBe(100);

    expect(result.columns).toBe(3);
    expect(result.rows).toBe(3);
    expect(result.warnings).toEqual([]);
  });

  it("returns 6 x-edges and 4 y-edges for the 5x3 full-pitch preset", () => {
    const result = resolvePitchZonePresetEdges("5x3", "full");
    if (result.xEdges === undefined) throw new Error("expected edges");

    expect(result.xEdges).toHaveLength(6);
    expect(result.xEdges[0]).toBe(0);
    expect(result.xEdges[5]).toBe(100);
    expect(result.yEdges).toHaveLength(4);
    expect(result.columns).toBe(5);
    expect(result.rows).toBe(3);
  });

  it("spans only the attacking half for the 3x3 half-pitch preset", () => {
    const result = resolvePitchZonePresetEdges("3x3", "half");
    if (result.xEdges === undefined) throw new Error("expected edges");

    expect(result.xEdges[0]).toBe(50);
    expect(result.xEdges[result.xEdges.length - 1]).toBe(100);
    expect(result.columns).toBe(3);
  });
});

describe("resolvePitchZonePresetEdges — tactical presets", () => {
  it("returns non-uniform edges for the '18' tactical preset on full pitch", () => {
    const result = resolvePitchZonePresetEdges("18", "full");
    if (result.xEdges === undefined) throw new Error("expected edges");

    expect(result.xEdges.length).toBeGreaterThanOrEqual(2);
    expect(result.xEdges[0]).toBe(0);
    expect(result.xEdges[result.xEdges.length - 1]).toBe(100);
    // Edges are strictly monotonic.
    for (let i = 1; i < result.xEdges.length; i += 1) {
      expect(result.xEdges[i]).toBeGreaterThan(result.xEdges[i - 1] ?? -1);
    }
    expect(result.columns).toBe(result.xEdges.length - 1);
    expect(result.rows).toBe(result.yEdges.length - 1);
    expect(result.warnings).toEqual([]);
  });

  it("refuses '18' on half pitch and returns only a warning", () => {
    const result = resolvePitchZonePresetEdges("18", "half");
    expect(result.xEdges).toBeUndefined();
    expect(result.yEdges).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/half/);
    expect(result.warnings[0]).toMatch(/18/);
  });

  it("also supports the '20' tactical preset on full pitch", () => {
    const result = resolvePitchZonePresetEdges("20", "full");
    if (result.xEdges === undefined) throw new Error("expected edges");

    expect(result.xEdges[0]).toBe(0);
    expect(result.xEdges[result.xEdges.length - 1]).toBe(100);
    expect(result.columns * result.rows).toBeGreaterThanOrEqual(12);
  });
});

describe("warning helpers", () => {
  it("zonePresetGridOverrideWarning distinguishes grid from gridX/gridY", () => {
    expect(zonePresetGridOverrideWarning("grid")).toMatch(/grid is ignored/);
    expect(zonePresetGridOverrideWarning("gridX/gridY")).toMatch(
      /gridX\/gridY are ignored/,
    );
  });

  it("zonePresetFullPitchOnlyWarning includes the preset name", () => {
    expect(zonePresetFullPitchOnlyWarning("18")).toContain("18");
    expect(zonePresetFullPitchOnlyWarning("20")).toContain("20");
  });

  it("ZONE_PRESET_EXPLICIT_EDGES_WARNING is a non-empty string", () => {
    expect(ZONE_PRESET_EXPLICIT_EDGES_WARNING).toMatch(/explicit edges/);
  });
});
