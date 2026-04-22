import { PITCH } from "../geometry/constants.js";

export type ProjectFn = (x: number, y: number) => { x: number; y: number };
/** Visible pitch crop. The projection still returns full-pitch meter coordinates. */
export type PitchCrop = "full" | "half" | "penalty-area";
/**
 * The direction the attacker is facing on screen. This fully determines the
 * pitch orientation (horizontal vs vertical) and which way the goal points.
 *
 * - `"right"` — attacker faces east, goal on the right (default horizontal)
 * - `"left"`  — attacker faces west, goal on the left
 * - `"up"`    — attacker faces north, goal on top (default vertical)
 * - `"down"`  — attacker faces south, goal on bottom
 */
export type AttackingDirection = "up" | "down" | "left" | "right";
/**
 * High-level pitch layout orientation, derived from `AttackingDirection`.
 * Exported for pitch markings that are direction-agnostic (the lines look
 * the same whether attackers face left or right).
 */
export type Orientation = "vertical" | "horizontal";
/**
 * Visible end for cropped pitch surfaces. `attack` means the end the attacker
 * is attacking — which side that lands on visually depends on
 * `AttackingDirection`.
 */
export type PitchSide = "attack" | "defend";

/** Returns whether the given attacking direction uses a horizontal pitch layout. */
export function orientationFromDirection(direction: AttackingDirection): Orientation {
  return direction === "left" || direction === "right" ? "horizontal" : "vertical";
}

/**
 * Create a projection function that maps Campos 0..100 coordinates (x = 0 own
 * goal, x = 100 opposition goal; y = 0 attacker's right, y = 100 attacker's
 * left) to SVG meter-scale user units (1 unit = 1 meter), respecting the
 * requested attacking direction.
 *
 * The projection preserves attacker-perspective semantics across all four
 * directions: a shot at `(camposX, 0)` — i.e., on the attacker's right side
 * of the pitch — always appears on the screen side corresponding to the
 * attacker's right hand in their facing direction.
 *
 *   direction="right" — attacker faces east  → attacker's right is south (SVG bottom)
 *   direction="left"  — attacker faces west  → attacker's right is north (SVG top)
 *   direction="up"    — attacker faces north → attacker's right is east  (SVG right)
 *   direction="down"  — attacker faces south → attacker's right is west  (SVG left)
 *
 * Crop only affects the SVG viewBox (what's visible), not the projection math.
 */
export function createPitchProjection(
  _crop: PitchCrop,
  direction: AttackingDirection,
): ProjectFn {
  return (camposX: number, camposY: number) => {
    switch (direction) {
      case "right":
        return {
          x: (camposX / 100) * PITCH.length,
          y: ((100 - camposY) / 100) * PITCH.width,
        };
      case "left":
        return {
          x: ((100 - camposX) / 100) * PITCH.length,
          y: (camposY / 100) * PITCH.width,
        };
      case "up":
        // attacker faces north. right hand points east → SVG right.
        // camposY=0 (attacker's right) → svgX = PITCH.width.
        return {
          x: ((100 - camposY) / 100) * PITCH.width,
          y: ((100 - camposX) / 100) * PITCH.length,
        };
      case "down":
        // attacker faces south. right hand points west → SVG left.
        // camposY=0 (attacker's right) → svgX = 0.
        return {
          x: (camposY / 100) * PITCH.width,
          y: (camposX / 100) * PITCH.length,
        };
    }
  };
}
