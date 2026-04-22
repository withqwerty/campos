import { GOAL } from "./constants.js";

export type GoalMarking = {
  id: string;
  type: "rect" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
};

/** Compute goal frame markings in meters. Origin (0,0) = top-left of goal. */
export function computeGoalMarkings(): GoalMarking[] {
  return [
    {
      id: "frame",
      type: "rect",
      x: 0,
      y: 0,
      width: GOAL.width,
      height: GOAL.depth,
    },
    {
      id: "ground",
      type: "line",
      x: 0,
      y: GOAL.depth,
      x2: GOAL.width,
      y2: GOAL.depth,
    },
  ];
}
