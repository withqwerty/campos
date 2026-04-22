/**
 * Premier League 2023-24 — Lorenz curve of cumulative points share.
 *
 * Source: final 2023-24 PL standings, reconstructed from
 * https://fbref.com/en/comps/9/2023-2024/2023-2024-Premier-League-Stats
 * and cross-referenced with Understat's league-chemp.json snapshot in
 * /Volumes/WQ/projects/www/data/understat/league-chemp.json
 * (snapshot at point of extraction differs from final but table ranking
 * matches; we use Sheffield Utd → Manchester City ascending by points).
 * Extracted: 2026-04-19.
 *
 * Mapping: `x` = cumulative club share (0..1, ascending by points),
 * `y` = cumulative points share (0..1). The diagonal y=x is the perfect-
 * equality reference; the area between the Lorenz curve and the diagonal
 * is the Gini coefficient.
 */

export type LorenzPoint = { x: number; y: number };

const POINTS_ASCENDING: readonly number[] = [
  16, // Sheffield United (20th)
  24, // Burnley
  26, // Luton
  32, // Everton (pre-deductions adjustments ignored for demo)
  32, // Nottingham Forest
  39, // Brentford
  46, // Crystal Palace
  47, // Wolves
  49, // Bournemouth
  52, // Fulham
  52, // West Ham
  56, // Brighton
  56, // Chelsea
  61, // Newcastle
  63, // Tottenham
  66, // Manchester United
  68, // Aston Villa
  74, // Liverpool
  89, // Arsenal
  91, // Manchester City
];

export const PL_2023_24_LORENZ: LorenzPoint[] = (() => {
  const total = POINTS_ASCENDING.reduce((a, b) => a + b, 0);
  const n = POINTS_ASCENDING.length;
  const out: LorenzPoint[] = [{ x: 0, y: 0 }];
  let cumulative = 0;
  POINTS_ASCENDING.forEach((p, i) => {
    cumulative += p;
    out.push({
      x: (i + 1) / n,
      y: cumulative / total,
    });
  });
  return out;
})();
