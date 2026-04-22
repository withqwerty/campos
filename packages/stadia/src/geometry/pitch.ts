import { PITCH, GOAL } from "./constants.js";

export type PitchMarkingType = "rect" | "line" | "circle" | "arc";

export type PitchMarking = {
  id: string;
  type: PitchMarkingType;
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  x2?: number | undefined;
  y2?: number | undefined;
  cx?: number | undefined;
  cy?: number | undefined;
  r?: number | undefined;
  startAngle?: number | undefined;
  endAngle?: number | undefined;
  /** If true, render as a filled dot (penalty/center spot) */
  filled?: boolean;
  /** If true, render with thicker stroke (goal line) */
  thick?: boolean;
};

export type PitchCrop = "full" | "half" | "penalty-area";
export type PitchOrientation = "vertical" | "horizontal";
export type PitchSide = "attack" | "defend";

// Computed constants
const HW = PITCH.width / 2;
const boxLeft = (PITCH.width - PITCH.penaltyAreaWidth) / 2;
const sixLeft = (PITCH.width - PITCH.goalAreaWidth) / 2;
const goalLeft = (PITCH.width - GOAL.width) / 2;

// Penalty arc: angle where the 9.15m circle exits the penalty area.
// Circle center at (HW, penaltySpotDistance), boundary at y = penaltyAreaLength.
// dy = penaltyAreaLength - penaltySpotDistance = 5.5m
// dy from penalty spot to box boundary
const arcDy = PITCH.penaltyAreaLength - PITCH.penaltySpotDistance; // 5.5m

/** All markings in VERTICAL orientation: origin (0,0) = top-left, x = width, y = length (down). */
function verticalMarkings(crop: PitchCrop): PitchMarking[] {
  const m: PitchMarking[] = [];

  // Boundary
  m.push({
    id: "boundary",
    type: "rect",
    x: 0,
    y: 0,
    width: PITCH.width,
    height: PITCH.length,
  });

  // === Top end (attacking goal) ===
  // Penalty area
  m.push({
    id: "pa-top",
    type: "rect",
    x: boxLeft,
    y: 0,
    width: PITCH.penaltyAreaWidth,
    height: PITCH.penaltyAreaLength,
  });
  // Six-yard box
  m.push({
    id: "6yd-top",
    type: "rect",
    x: sixLeft,
    y: 0,
    width: PITCH.goalAreaWidth,
    height: PITCH.goalAreaLength,
  });
  // Goal line
  m.push({
    id: "goal-top",
    type: "line",
    x: goalLeft,
    y: 0,
    x2: goalLeft + GOAL.width,
    y2: 0,
    thick: true,
  });
  // Penalty spot
  m.push({
    id: "pen-spot-top",
    type: "circle",
    cx: HW,
    cy: PITCH.penaltySpotDistance,
    r: 0.3,
    filled: true,
  });
  // Penalty arc: the D-shape OUTSIDE the penalty area.
  // arcHalfAngle = acos(5.5/9.15). sin(arcHalfAngle) = sqrt(1 - (5.5/9.15)²) ≈ 0.799
  // But we need asin(5.5/9.15) ≈ 0.644 rad — the angle where the circle crosses y=16.5
  // The arc outside sweeps through the bottom (SVG y-down = positive sin), from asin to π-asin
  {
    const asinAngle = Math.asin(arcDy / PITCH.penaltyArcRadius); // ≈ 0.644 rad
    m.push({
      id: "pen-arc-top",
      type: "arc",
      cx: HW,
      cy: PITCH.penaltySpotDistance,
      r: PITCH.penaltyArcRadius,
      startAngle: asinAngle,
      endAngle: Math.PI - asinAngle,
    });
  }

  if (crop === "full") {
    // === Bottom end ===
    m.push({
      id: "pa-bottom",
      type: "rect",
      x: boxLeft,
      y: PITCH.length - PITCH.penaltyAreaLength,
      width: PITCH.penaltyAreaWidth,
      height: PITCH.penaltyAreaLength,
    });
    m.push({
      id: "6yd-bottom",
      type: "rect",
      x: sixLeft,
      y: PITCH.length - PITCH.goalAreaLength,
      width: PITCH.goalAreaWidth,
      height: PITCH.goalAreaLength,
    });
    m.push({
      id: "goal-bottom",
      type: "line",
      x: goalLeft,
      y: PITCH.length,
      x2: goalLeft + GOAL.width,
      y2: PITCH.length,
      thick: true,
    });
    m.push({
      id: "pen-spot-bottom",
      type: "circle",
      cx: HW,
      cy: PITCH.length - PITCH.penaltySpotDistance,
      r: 0.3,
      filled: true,
    });
    // Bottom penalty arc: outside = above the box = negative y direction = angles through 3π/2
    {
      const asinAngle = Math.asin(arcDy / PITCH.penaltyArcRadius);
      m.push({
        id: "pen-arc-bottom",
        type: "arc",
        cx: HW,
        cy: PITCH.length - PITCH.penaltySpotDistance,
        r: PITCH.penaltyArcRadius,
        startAngle: Math.PI + asinAngle,
        endAngle: 2 * Math.PI - asinAngle,
      });
    }

    // Halfway
    m.push({
      id: "halfway",
      type: "line",
      x: 0,
      y: PITCH.length / 2,
      x2: PITCH.width,
      y2: PITCH.length / 2,
    });
    // Center circle
    m.push({
      id: "center-circle",
      type: "circle",
      cx: HW,
      cy: PITCH.length / 2,
      r: PITCH.centerCircleRadius,
    });
    // Center spot
    m.push({
      id: "center-spot",
      type: "circle",
      cx: HW,
      cy: PITCH.length / 2,
      r: 0.3,
      filled: true,
    });

    // Corner arcs
    m.push({
      id: "corner-tl",
      type: "arc",
      cx: 0,
      cy: 0,
      r: PITCH.cornerArcRadius,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    m.push({
      id: "corner-tr",
      type: "arc",
      cx: PITCH.width,
      cy: 0,
      r: PITCH.cornerArcRadius,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
    });
    m.push({
      id: "corner-bl",
      type: "arc",
      cx: 0,
      cy: PITCH.length,
      r: PITCH.cornerArcRadius,
      startAngle: (3 * Math.PI) / 2,
      endAngle: 2 * Math.PI,
    });
    m.push({
      id: "corner-br",
      type: "arc",
      cx: PITCH.width,
      cy: PITCH.length,
      r: PITCH.cornerArcRadius,
      startAngle: Math.PI,
      endAngle: (3 * Math.PI) / 2,
    });
  }

  if (crop === "half") {
    // Unmirrored attacking half: halfway line at the bottom edge.
    // Defensive halves are produced by mirroring these markings later.
    m.push({
      id: "halfway",
      type: "line",
      x: 0,
      y: PITCH.length / 2,
      x2: PITCH.width,
      y2: PITCH.length / 2,
    });
    // Center spot
    m.push({
      id: "center-spot",
      type: "circle",
      cx: HW,
      cy: PITCH.length / 2,
      r: 0.3,
      filled: true,
    });
    // Center arc visible at the bottom of the attacking half; it bulges into
    // the visible half before mirroring.
    m.push({
      id: "center-arc",
      type: "arc",
      cx: HW,
      cy: PITCH.length / 2,
      r: PITCH.centerCircleRadius,
      startAngle: Math.PI,
      endAngle: 2 * Math.PI,
    });
    // Attacking-end corners before mirroring.
    m.push({
      id: "corner-tl",
      type: "arc",
      cx: 0,
      cy: 0,
      r: PITCH.cornerArcRadius,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    m.push({
      id: "corner-tr",
      type: "arc",
      cx: PITCH.width,
      cy: 0,
      r: PITCH.cornerArcRadius,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
    });
  }

  return m;
}

/** Swap a vertical marking to horizontal: (x,y) → (y,x), dimensions swapped. */
function toHorizontal(m: PitchMarking): PitchMarking {
  switch (m.type) {
    case "rect":
      return {
        ...m,
        x: m.y ?? 0,
        y: m.x ?? 0,
        width: m.height ?? 0,
        height: m.width ?? 0,
      };
    case "line":
      return { ...m, x: m.y ?? 0, y: m.x ?? 0, x2: m.y2 ?? 0, y2: m.x2 ?? 0 };
    case "circle":
      return { ...m, cx: m.cy ?? 0, cy: m.cx ?? 0 };
    case "arc":
      // The (x, y) → (y, x) swap rotates a unit vector at angle θ to one at
      // angle (π/2 − θ). That reverses sweep direction, so we also swap
      // start/end to keep the arc pointing inward at every corner.
      return {
        ...m,
        cx: m.cy ?? 0,
        cy: m.cx ?? 0,
        startAngle: Math.PI / 2 - (m.endAngle ?? 0),
        endAngle: Math.PI / 2 - (m.startAngle ?? 0),
      };
    default:
      return m;
  }
}

function swapEndId(id: string) {
  if (id.includes("-top")) return id.replace("-top", "-bottom");
  if (id.includes("-bottom")) return id.replace("-bottom", "-top");
  if (id === "corner-tl") return "corner-bl";
  if (id === "corner-tr") return "corner-br";
  if (id === "corner-bl") return "corner-tl";
  if (id === "corner-br") return "corner-tr";
  return id;
}

function mirrorVertical(m: PitchMarking): PitchMarking {
  switch (m.type) {
    case "rect":
      return {
        ...m,
        id: swapEndId(m.id),
        y: PITCH.length - (m.y ?? 0) - (m.height ?? 0),
      };
    case "line":
      return {
        ...m,
        id: swapEndId(m.id),
        y: PITCH.length - (m.y ?? 0),
        y2: PITCH.length - (m.y2 ?? 0),
      };
    case "circle":
      return {
        ...m,
        id: swapEndId(m.id),
        cy: PITCH.length - (m.cy ?? 0),
      };
    case "arc": {
      const start = m.startAngle ?? 0;
      const end = m.endAngle ?? 0;
      return {
        ...m,
        id: swapEndId(m.id),
        cy: PITCH.length - (m.cy ?? 0),
        startAngle: 2 * Math.PI - end,
        endAngle: 2 * Math.PI - start,
      };
    }
    default:
      return { ...m, id: swapEndId(m.id) };
  }
}

/**
 * Compute pitch marking definitions for a given crop and orientation.
 * Returns markings in meter coordinates ready for SVG rendering.
 *
 * For cropped surfaces, `side` selects the visible physical end:
 * attack is top/right, defend is bottom/left.
 */
export function computePitchMarkings(
  crop: PitchCrop,
  orientation: PitchOrientation = "vertical",
  side: PitchSide = "attack",
): PitchMarking[] {
  // `side` picks the physical end of the pitch for cropped surfaces:
  // vertical attack=top, vertical defend=bottom; horizontal attack=right,
  // horizontal defend=left. Horizontal markings are produced by swapping
  // vertical coordinates, so the right-side horizontal goal starts from the
  // mirrored vertical bottom-end markings.
  const shouldMirrorVertical =
    crop !== "full" &&
    (orientation === "vertical" ? side === "defend" : side === "attack");
  const marks =
    crop === "full"
      ? verticalMarkings(crop)
      : shouldMirrorVertical
        ? verticalMarkings(crop).map(mirrorVertical)
        : verticalMarkings(crop);
  if (orientation === "horizontal") {
    return marks.map(toHorizontal);
  }
  return marks;
}
