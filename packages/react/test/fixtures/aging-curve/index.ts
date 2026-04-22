/**
 * Synthetic football aging curve fixture.
 *
 * Source: **synthetic** — modelled on the canonical per-90 aging curve for
 * attacking midfielders from public-domain football-analytics literature.
 * Shape reproduces the "accelerates into mid-20s, peaks at 27, slow
 * decline" pattern you see in FBref-style per-90 output.
 * Values are illustrative — do not cite as real data.
 *
 * Extracted: 2026-04-19.
 *
 * `positionMean` — per-90 G+A for an attacking midfielder, ages 18-34.
 * `sigmaUpper` / `sigmaLower` — one-sigma band offsets aligned index-by-
 * index to positionMean.
 * `playerTrajectory` — illustrative player whose curve hugs the mean until
 * age 25, outperforms at peak 27-29, then decays faster than the cohort.
 */

export type AgingPoint = { x: number; y: number };

export const AGING_AGES: readonly number[] = [
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
];

export const POSITION_MEAN: AgingPoint[] = [
  { x: 18, y: 0.18 },
  { x: 19, y: 0.22 },
  { x: 20, y: 0.27 },
  { x: 21, y: 0.33 },
  { x: 22, y: 0.4 },
  { x: 23, y: 0.46 },
  { x: 24, y: 0.5 },
  { x: 25, y: 0.54 },
  { x: 26, y: 0.55 },
  { x: 27, y: 0.55 },
  { x: 28, y: 0.54 },
  { x: 29, y: 0.51 },
  { x: 30, y: 0.47 },
  { x: 31, y: 0.43 },
  { x: 32, y: 0.38 },
  { x: 33, y: 0.32 },
  { x: 34, y: 0.26 },
];

// 1-sigma envelope — roughly 0.1 wide around peak, tightening at ends.
export const SIGMA_UPPER: readonly number[] = [
  0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.09, 0.09, 0.08, 0.07,
  0.07,
];

export const SIGMA_LOWER: readonly number[] = SIGMA_UPPER.map((v) => -v);

export const PLAYER_TRAJECTORY: AgingPoint[] = [
  { x: 18, y: 0.2 },
  { x: 19, y: 0.25 },
  { x: 20, y: 0.3 },
  { x: 21, y: 0.35 },
  { x: 22, y: 0.42 },
  { x: 23, y: 0.48 },
  { x: 24, y: 0.52 },
  { x: 25, y: 0.58 },
  { x: 26, y: 0.62 },
  { x: 27, y: 0.65 },
  { x: 28, y: 0.64 },
  { x: 29, y: 0.6 },
  { x: 30, y: 0.5 },
  { x: 31, y: 0.4 },
  { x: 32, y: 0.32 },
  { x: 33, y: 0.24 },
  { x: 34, y: 0.18 },
];
