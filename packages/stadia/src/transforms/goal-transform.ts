import { GOAL } from "../geometry/constants.js";

export type GoalProjectFn = (goalY: number, goalZ: number) => { x: number; y: number };
export type GoalFacing = "striker" | "goalkeeper";

export type GoalProjectionOptions = {
  /**
   * Optional frame-thickness inset, in SVG user units. When supplied, the
   * projection maps `goalY: 0..100` into the playing area bounded by the
   * **inside** edges of the posts and crossbar (i.e. into
   * `[frameThickness, GOAL.width - frameThickness]`) and `goalZ: 0..100`
   * into `[GOAL.depth, frameThickness]`. This keeps shot markers inside
   * the posts rather than having their centres land on the outer edge
   * where `GoalFrame` draws the post stroke.
   *
   * Default: `0` — legacy behaviour where `(0, 0)` lands on the outer
   * bottom-left corner and `(100, 100)` on the outer top-right corner.
   * `Goal` passes its configured `barThickness` so the default rendering
   * always places markers inside the posts.
   */
  frameThickness?: number;
};

/**
 * Create a projection for goal-mouth coordinates.
 *
 * goalY: 0-100 across goal width (0 = left post inside edge, 100 = right)
 * goalZ: 0-100 ground to crossbar (0 = ground, 100 = crossbar inside edge)
 *
 * Striker facing: left post = screen-left
 * Goalkeeper facing: mirrored (left post = screen-right)
 */
export function createGoalProjection(
  facing: GoalFacing,
  options: GoalProjectionOptions = {},
): GoalProjectFn {
  const { frameThickness = 0 } = options;
  const playLeft = frameThickness;
  const playRight = GOAL.width - frameThickness;
  const playTop = frameThickness;
  const playBottom = GOAL.depth;
  const playWidth = playRight - playLeft;
  const playHeight = playBottom - playTop;

  return (goalY: number, goalZ: number) => {
    const normalizedX = goalY / 100;
    const normalizedZ = goalZ / 100;

    const xInPlay = playLeft + normalizedX * playWidth;
    const yInPlay = playBottom - normalizedZ * playHeight;

    const svgX = facing === "striker" ? xInPlay : GOAL.width - xInPlay;
    return { x: svgX, y: yInPlay };
  };
}
