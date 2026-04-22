import type { UITheme } from "../theme.js";

export function ChartPlotAreaBackground({
  plotArea,
  theme,
  rx,
}: {
  plotArea: { x: number; y: number; width: number; height: number };
  theme: UITheme;
  rx?: number;
}) {
  const resolvedRx = rx ?? theme.radius.xs;

  return (
    <rect
      x={plotArea.x}
      y={plotArea.y}
      width={plotArea.width}
      height={plotArea.height}
      fill={theme.surface.plot}
      rx={resolvedRx}
    />
  );
}
