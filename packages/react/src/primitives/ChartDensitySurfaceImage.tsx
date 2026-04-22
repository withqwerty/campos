import type { ProjectFn } from "@withqwerty/campos-stadia";

import { projectFullPitchRect } from "../pitchGeometry.js";

export function ChartDensitySurfaceImage({
  href,
  project,
  opacity,
  testId = "density-surface",
}: {
  href: string | null;
  project: ProjectFn;
  opacity?: number;
  testId?: string;
}) {
  if (!href) return null;

  const { x, y, width, height } = projectFullPitchRect(project);

  return (
    <image
      href={href}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="none"
      {...(opacity != null ? { opacity } : {})}
      data-testid={testId}
    />
  );
}
