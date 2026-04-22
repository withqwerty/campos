/**
 * Premier League 2023-24 — Manchester City cumulative points by matchweek,
 * alongside the "top-4 pace" (Aston Villa's 68-point full-season pace
 * expressed as a linear extrapolation across the 38-week season).
 *
 * Source: final standings cross-referenced with matchweek cumulative
 * progressions on https://fbref.com/en/comps/9/2023-2024/2023-2024-Premier-League-Stats
 * and Opta season review. Values are rounded to integer points.
 * Extracted: 2026-04-19.
 *
 * The "pace" series is not an actual team — it's a reference curve showing
 * the points-per-week a side would need to finish on 68 pts (4th place
 * Aston Villa, 2023-24). Used to demonstrate `series-pair` envelopes where
 * the fill flips colour when the actual curve crosses the pace line.
 */
export type PacePoint = { x: number; y: number };

const MAN_CITY_CUMULATIVE: readonly number[] = [
  3, 6, 9, 12, 13, 16, 19, 22, 25, 28, 31, 32, 35, 38, 41, 44, 47, 48, 51, 54, 57, 60, 63,
  66, 67, 70, 73, 76, 79, 82, 83, 85, 86, 86, 89, 89, 91, 91,
];

export const MAN_CITY_2023_24_PACE: PacePoint[] = MAN_CITY_CUMULATIVE.map((y, i) => ({
  x: i + 1,
  y,
}));

const TOP_4_FINAL = 68; // Aston Villa 2023-24
export const TOP_4_PACE_2023_24: PacePoint[] = Array.from({ length: 38 }, (_, i) => ({
  x: i + 1,
  y: ((i + 1) / 38) * TOP_4_FINAL,
}));
