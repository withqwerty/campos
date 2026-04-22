import { PITCH } from "./constants.js";

/**
 * Tactical-zone edge constants in Campos canonical 0..100 units
 * (attacker-perspective, `x: 0 = own goal → 100 = opposition goal`, `y: 0
 * = attacker's right → 100 = attacker's left`).
 *
 * Consumed by the zone predicates in `zones-predicates.ts` and the
 * 18-zone bin edges in `zones.ts`. FIFA-pitch dimensions come from
 * {@link PITCH}; the mapping is a plain linear scale.
 */

/** Third boundaries along pitch length: defensive / middle / attacking. */
export const THIRD_EDGE_LOW = 100 / 3;
export const THIRD_EDGE_HIGH = (100 * 2) / 3;

/**
 * Channel boundaries across pitch width: right / centre / left. Campos
 * `y` grows toward the attacker's left, so the low edge separates right
 * from centre and the high edge separates centre from left.
 */
export const CHANNEL_EDGE_LOW = 100 / 3;
export const CHANNEL_EDGE_HIGH = (100 * 2) / 3;

/**
 * Penalty-box extents in Campos units, derived from FIFA
 * `penaltyAreaLength` (16.5 m) and `penaltyAreaWidth` (40.32 m). The
 * opposition box runs from `x = OPPOSITION_BOX_X_MIN` to `x = 100`; the
 * own box runs from `x = 0` to `x = OWN_BOX_X_MAX`. The y-band is
 * centred on the halfway line (`y = 50`).
 */
export const OPPOSITION_BOX_X_MIN = 100 - (PITCH.penaltyAreaLength / PITCH.length) * 100;
export const OWN_BOX_X_MAX = (PITCH.penaltyAreaLength / PITCH.length) * 100;
export const BOX_Y_MIN = 50 - (PITCH.penaltyAreaWidth / PITCH.width) * 50;
export const BOX_Y_MAX = 50 + (PITCH.penaltyAreaWidth / PITCH.width) * 50;
