// Geometry
export { PITCH, GOAL } from "./geometry/constants.js";
export {
  computePitchMarkings,
  type PitchMarking,
  type PitchMarkingType,
} from "./geometry/pitch.js";
export { computeGoalMarkings, type GoalMarking } from "./geometry/goal.js";

// Transforms
export {
  createPitchProjection,
  orientationFromDirection,
  type ProjectFn,
  type PitchCrop,
  type Orientation,
  type AttackingDirection,
  type PitchSide,
} from "./transforms/pitch-transform.js";
export {
  createGoalProjection,
  type GoalProjectFn,
  type GoalFacing,
  type GoalProjectionOptions,
} from "./transforms/goal-transform.js";
export { computeViewBox, type ViewBox } from "./transforms/viewbox.js";

// React components
export {
  Pitch,
  type PitchMarkingsConfig,
  type PitchPadding,
  type PitchProps,
} from "./react/Pitch.js";
export { Goal, type GoalPadding, type GoalProps } from "./react/Goal.js";

// Theme
export type { PitchColors, GoalColors, Theme } from "./react/theme.js";

// Grass patterns
export type { GrassPattern } from "./react/grass.js";

// Tactical markings
export type { ZoneLayout } from "./react/TacticalMarkings.js";

// Zone binning for PassFlow / Heatmap / other binned charts
export { zoneEdgesInCampos, type ZoneEdges } from "./zones.js";

// Zone predicates + partitioning for event streams
export {
  partitionByZone,
  startsInThird,
  endsInThird,
  startsInChannel,
  endsInChannel,
  startsInBox,
  endsInBox,
  THIRD_EDGE_LOW,
  THIRD_EDGE_HIGH,
  CHANNEL_EDGE_LOW,
  CHANNEL_EDGE_HIGH,
  OPPOSITION_BOX_X_MIN,
  OWN_BOX_X_MAX,
  BOX_Y_MIN,
  BOX_Y_MAX,
  type PitchThird,
  type PitchChannel,
  type PitchBox,
  type ZoneEventCoords,
} from "./zones-predicates.js";
