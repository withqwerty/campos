import { describe, expect, it } from "vitest";

import type { KDEModel } from "../src/compute/index.js";
import type { ProjectFn } from "@withqwerty/campos-stadia";

import {
  getProjectedPitchBounds,
  sampleKDEAtPitchPoint,
  svgPointToPitchPoint,
} from "../src/kdeProjection";

const identityProject: ProjectFn = (x, y) => ({ x, y });

function makeModel(): KDEModel {
  return {
    meta: {
      component: "KDE",
      empty: false,
      attackingDirection: "right",
      crop: "full",
      warnings: [],
      totalEvents: 8,
      validEvents: 8,
      bandwidthX: 5,
      bandwidthY: 5,
    },
    density: {
      gridWidth: 4,
      gridHeight: 2,
      grid: new Float64Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
      maxDensity: 0.8,
      threshold: 0.05,
    },
    scaleBar: {
      label: "Density",
      domain: [0, 0.8],
    },
    pitch: {
      crop: "full",
      attackingDirection: "right",
    },
    emptyState: null,
  };
}

describe("kdeProjection", () => {
  it("derives pitch bounds from the projected pitch corners", () => {
    expect(getProjectedPitchBounds(identityProject)).toEqual({
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100,
    });
  });

  it("reverse-projects SVG points back into pitch space", () => {
    // Identity projection maps pitch coords to SVG coords unchanged,
    // so the inverse should return the input. (The old code had a
    // hardcoded X-axis inversion that produced x:75 here — that was
    // wrong for identity but masked by symmetry in real pitch use.)
    expect(svgPointToPitchPoint(identityProject, { x: 25, y: 40 })).toEqual({
      x: 25,
      y: 40,
    });
  });

  it("clamps sampled pitch coordinates and resolves the matching density cell", () => {
    expect(sampleKDEAtPitchPoint(makeModel(), { x: 120, y: -10 })).toEqual({
      pitchX: 100,
      pitchY: 0,
      col: 3,
      row: 0,
      density: 0.4,
    });
  });
});
