import { describe, expect, it } from "vitest";

import {
  pitchMarkingsForZonePreset,
  resolvePitchZonePresetEdges,
} from "../src/pitchZonePresets.js";

describe("pitchZonePresets", () => {
  it("resolves 3x3 presets for both full and half-pitch crops", () => {
    const full = resolvePitchZonePresetEdges("3x3");
    const half = resolvePitchZonePresetEdges("3x3", "half");

    expect(full.columns).toBe(3);
    expect(full.rows).toBe(3);
    expect(full.xEdges).toEqual([0, 100 / 3, (2 * 100) / 3, 100]);

    expect(half.columns).toBe(3);
    expect(half.rows).toBe(3);
    expect(half.xEdges).toEqual([50, 50 + 100 / 6, 50 + 100 / 3, 100]);
  });

  it("maps tactical presets to stadia zone layouts", () => {
    const positional = resolvePitchZonePresetEdges("20");

    expect(positional.columns).toBe(4);
    expect(positional.rows).toBe(5);
    expect(pitchMarkingsForZonePreset("20")).toEqual({ zones: "20" });
    expect(positional.warnings).toEqual([]);
  });

  it('warns and returns no edges for full-pitch-only tactical presets with crop="half"', () => {
    const resolution = resolvePitchZonePresetEdges("18", "half");

    expect(resolution.xEdges).toBeUndefined();
    expect(resolution.yEdges).toBeUndefined();
    expect(resolution.warnings[0]).toMatch(/full-pitch only/);
  });
});
