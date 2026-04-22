import type { KDEModel } from "./compute/index.js";
import type { ProjectFn } from "@withqwerty/campos-stadia";

export type PitchPoint = {
  x: number;
  y: number;
};

export type KDESample = {
  pitchX: number;
  pitchY: number;
  col: number;
  row: number;
  density: number;
};

export function getProjectedPitchBounds(project: ProjectFn): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const topLeft = project(100, 0);
  const bottomRight = project(0, 100);

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}

export function svgPointToPitchPoint(
  project: ProjectFn,
  svgPoint: PitchPoint,
): PitchPoint {
  // Solve the linear system that the forward projection induces, instead of
  // hardcoding a horizontal-pitch axis flip. This works under both horizontal
  // and vertical orientations (and any future rotation Stadia might introduce)
  // because we recover pitch coords from the projected basis vectors.
  const origin = project(0, 0);
  const xBasis = project(100, 0);
  const yBasis = project(0, 100);

  const sx = svgPoint.x - origin.x;
  const sy = svgPoint.y - origin.y;
  const ax = xBasis.x - origin.x;
  const ay = xBasis.y - origin.y;
  const bx = yBasis.x - origin.x;
  const by = yBasis.y - origin.y;

  const det = ax * by - bx * ay;
  if (det === 0) {
    return { x: 0, y: 0 };
  }
  const pitchXNorm = (sx * by - bx * sy) / det;
  const pitchYNorm = (ax * sy - sx * ay) / det;

  return {
    x: clampPitchCoordinate(pitchXNorm * 100),
    y: clampPitchCoordinate(pitchYNorm * 100),
  };
}

export function sampleKDEAtPitchPoint(
  model: KDEModel,
  pitchPoint: PitchPoint,
): KDESample {
  const pitchX = clampPitchCoordinate(pitchPoint.x);
  const pitchY = clampPitchCoordinate(pitchPoint.y);
  const { gridWidth, gridHeight, grid } = model.density;
  const col = sampleGridIndex(pitchX, gridWidth);
  const row = sampleGridIndex(pitchY, gridHeight);

  return {
    pitchX,
    pitchY,
    col,
    row,
    density: grid[row * gridWidth + col] ?? 0,
  };
}

function sampleGridIndex(value: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.floor((value / 100) * size)));
}

function clampPitchCoordinate(value: number): number {
  return Math.max(0, Math.min(100, value));
}
