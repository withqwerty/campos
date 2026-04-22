/** FIFA standard pitch dimensions in meters. Not configurable. */
export const PITCH = {
  length: 105,
  width: 68,
  centerCircleRadius: 9.15,
  penaltyAreaLength: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaLength: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  penaltyArcRadius: 9.15,
  cornerArcRadius: 1,
} as const;

/** FIFA standard goal dimensions in meters. */
export const GOAL = {
  width: 7.32,
  depth: 2.44,
} as const;
