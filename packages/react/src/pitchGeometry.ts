import type { ProjectFn } from "@withqwerty/campos-stadia";

type PitchRectInput = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function projectPitchRect(project: ProjectFn, rect: PitchRectInput) {
  const topLeft = project(rect.x + rect.width, rect.y);
  const bottomRight = project(rect.x, rect.y + rect.height);

  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

export function projectFullPitchRect(project: ProjectFn) {
  return projectPitchRect(project, { x: 0, y: 0, width: 100, height: 100 });
}
