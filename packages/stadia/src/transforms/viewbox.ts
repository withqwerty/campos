import { PITCH, GOAL } from "../geometry/constants.js";
import type { PitchCrop, AttackingDirection, PitchSide } from "./pitch-transform.js";
import { orientationFromDirection } from "./pitch-transform.js";

export type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

type Padding = number | { top: number; right: number; bottom: number; left: number };

function resolveSideAndPadding(
  sideOrPadding: PitchSide | Padding | undefined,
  padding: Padding | undefined,
) {
  if (sideOrPadding === "attack" || sideOrPadding === "defend") {
    return { side: sideOrPadding, padding };
  }
  return { side: "attack" as const, padding: sideOrPadding };
}

function resolvePadding(
  padding: Padding | undefined,
  referenceWidth: number,
): { top: number; right: number; bottom: number; left: number } {
  if (padding == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === "number") {
    const p = (padding / 100) * referenceWidth;
    return { top: p, right: p, bottom: p, left: p };
  }
  return {
    top: (padding.top / 100) * referenceWidth,
    right: (padding.right / 100) * referenceWidth,
    bottom: (padding.bottom / 100) * referenceWidth,
    left: (padding.left / 100) * referenceWidth,
  };
}

/**
 * Compute an SVG viewBox for a pitch or goal surface.
 *
 * `direction` is the attacker's facing direction. For cropped pitch surfaces,
 * `side="attack"` selects the half the attacker is attacking toward (which
 * visually depends on the direction):
 *
 *   direction="right" → attack half is the right half (SVG x > length/2)
 *   direction="left"  → attack half is the left half  (SVG x < length/2)
 *   direction="up"    → attack half is the top half   (SVG y < length/2)
 *   direction="down"  → attack half is the bottom half (SVG y > length/2)
 */
export function computeViewBox(
  surface: PitchCrop | "goal",
  direction: AttackingDirection,
  sideOrPadding?: PitchSide | Padding,
  padding?: Padding,
): ViewBox {
  const { side, padding: resolvedPadding } = resolveSideAndPadding(
    sideOrPadding,
    padding,
  );
  const orientation = orientationFromDirection(direction);
  let baseWidth: number;
  let baseHeight: number;
  let baseMinX = 0;
  let baseMinY = 0;

  if (surface === "goal") {
    baseWidth = GOAL.width;
    baseHeight = GOAL.depth;
  } else if (surface === "full") {
    baseWidth = orientation === "vertical" ? PITCH.width : PITCH.length;
    baseHeight = orientation === "vertical" ? PITCH.length : PITCH.width;
  } else if (surface === "half") {
    baseWidth = orientation === "vertical" ? PITCH.width : PITCH.length / 2;
    baseHeight = orientation === "vertical" ? PITCH.length / 2 : PITCH.width;
    if (orientation === "vertical") {
      // Vertical: the attack end is wherever the attacker faces — top for
      // direction="up", bottom for direction="down".
      if (direction === "up") {
        baseMinY = side === "attack" ? 0 : PITCH.length / 2;
      } else {
        baseMinY = side === "attack" ? PITCH.length / 2 : 0;
      }
    } else if (direction === "right") {
      // Horizontal right: attacker faces east, attack half is right of centre.
      baseMinX = side === "attack" ? PITCH.length / 2 : 0;
    } else {
      // Horizontal left: attacker faces west, attack half is left of centre.
      baseMinX = side === "attack" ? 0 : PITCH.length / 2;
    }
  } else {
    // penalty-area: centered on the 18-yard box with some padding
    const paWidth = PITCH.penaltyAreaWidth + 4; // 2m padding each side
    // Height must include the full penalty arc (D): penaltySpot + arcRadius = 20.15m
    const arcBottom = PITCH.penaltySpotDistance + PITCH.penaltyArcRadius; // 20.15m
    const paHeight = arcBottom + 3; // 3m padding below the D
    baseWidth = orientation === "vertical" ? paWidth : paHeight;
    baseHeight = orientation === "vertical" ? paHeight : paWidth;
    if (orientation === "vertical") {
      baseMinX = (PITCH.width - paWidth) / 2;
      if (direction === "up") {
        baseMinY = side === "attack" ? -2 : PITCH.length - paHeight + 2;
      } else {
        baseMinY = side === "attack" ? PITCH.length - paHeight + 2 : -2;
      }
    } else {
      baseMinY = (PITCH.width - paWidth) / 2;
      if (direction === "right") {
        baseMinX = side === "attack" ? PITCH.length - paHeight + 2 : -2;
      } else {
        baseMinX = side === "attack" ? -2 : PITCH.length - paHeight + 2;
      }
    }
  }

  // Padding is scaled relative to the surface being rendered, so that a value
  // like `padding: 5` consistently means "~5% of the rendered surface" across
  // Pitch and Goal. If we scaled Goal padding against pitch width, `5` would
  // equal 3.4 m on a 7.32 m-wide goal — almost half the surface — which makes
  // the API impossible to reason about (and contradicted the docstring).
  const refWidth =
    surface === "goal"
      ? GOAL.width
      : orientation === "vertical"
        ? PITCH.width
        : PITCH.length;
  const pad = resolvePadding(resolvedPadding, refWidth);

  return {
    minX: baseMinX - pad.left,
    minY: baseMinY - pad.top,
    width: baseWidth + pad.left + pad.right,
    height: baseHeight + pad.top + pad.bottom,
  };
}
