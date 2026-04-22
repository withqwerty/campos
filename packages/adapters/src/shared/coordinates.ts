import { clampToCamposRange } from "@withqwerty/campos-schema";

export { clampToCamposRange };

const STATSPERFORM_GOAL_MOUTH_LEFT_POST_Y = 54.8;
const STATSPERFORM_GOAL_MOUTH_RIGHT_POST_Y = 45.2;
const STATSPERFORM_GOAL_MOUTH_CROSSBAR_Z = 38;

/**
 * Convert StatsBomb coordinates (120 x 80) to Campos range (0-100 x 0-100).
 *
 * StatsBomb uses a TOP_LEFT origin with y increasing downward (top of pitch
 * at y=0, bottom at y=80) and always stores events in attacker-perspective
 * form (action-executing team attacks toward increasing x).
 *
 * The Campos canonical frame has y=0 = attacker's right (physical bottom
 * when attacking left-to-right), so StatsBomb's y must be inverted:
 * StatsBomb y=80 (bottom, attacker's right) → Campos y=0.
 */
export function statsBombToCampos(x: number, y: number): { x: number; y: number } {
  return {
    x: clampToCamposRange((x / 120) * 100),
    y: clampToCamposRange(100 - (y / 80) * 100),
  };
}

/**
 * Convert raw StatsPerform/Opta goal-mouth qualifiers into Campos canonical
 * goal-frame percentages.
 *
 * Raw StatsPerform values use Appendix 12 goal-mouth zones where the in-frame
 * mouth spans Y=45.2..54.8 and Z=0..38. Higher raw Y values sit on the
 * screen-left side of the goal in striker-facing orientation, so the
 * horizontal axis must be reversed when mapping into Campos:
 *   - Campos goalMouthY: 0 = left post, 100 = right post
 *   - Campos goalMouthZ: 0 = ground, 100 = crossbar
 *
 * Values outside the physical goal frame return null for that axis.
 */
export function statsPerformGoalMouthToCampos(
  rawY: number | null | undefined,
  rawZ: number | null | undefined,
): {
  goalMouthY: number | null;
  goalMouthZ: number | null;
} {
  const yInFrame =
    typeof rawY === "number" &&
    Number.isFinite(rawY) &&
    rawY >= STATSPERFORM_GOAL_MOUTH_RIGHT_POST_Y &&
    rawY <= STATSPERFORM_GOAL_MOUTH_LEFT_POST_Y;
  const zInFrame =
    typeof rawZ === "number" &&
    Number.isFinite(rawZ) &&
    rawZ >= 0 &&
    rawZ <= STATSPERFORM_GOAL_MOUTH_CROSSBAR_Z;

  const goalMouthY = yInFrame
    ? Math.round(
        ((STATSPERFORM_GOAL_MOUTH_LEFT_POST_Y - rawY) /
          (STATSPERFORM_GOAL_MOUTH_LEFT_POST_Y - STATSPERFORM_GOAL_MOUTH_RIGHT_POST_Y)) *
          1000,
      ) / 10
    : null;
  const goalMouthZ = zInFrame
    ? Math.round((rawZ / STATSPERFORM_GOAL_MOUTH_CROSSBAR_Z) * 1000) / 10
    : null;

  return { goalMouthY, goalMouthZ };
}
