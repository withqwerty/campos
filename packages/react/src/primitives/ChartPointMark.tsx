import type { ReactNode } from "react";

export type PointShape = "circle" | "hexagon" | "square" | "triangle" | "diamond";

function polygonPoints({
  shape,
  cx,
  cy,
  r,
}: {
  shape: Exclude<PointShape, "circle" | "square">;
  cx: number;
  cy: number;
  r: number;
}) {
  switch (shape) {
    case "hexagon":
      return Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      }).join(" ");
    case "triangle": {
      const h = r * 1.15;
      return `${cx},${cy - h} ${cx + r},${cy + h * 0.6} ${cx - r},${cy + h * 0.6}`;
    }
    case "diamond":
      return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }
}

export function ChartPointMark({
  cx,
  cy,
  r,
  shape = "circle",
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  opacity,
  cornerRadius,
}: {
  cx: number;
  cy: number;
  r: number;
  shape?: PointShape;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cornerRadius?: number;
}): ReactNode {
  if (shape === "circle") {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        {...(fillOpacity != null ? { fillOpacity } : {})}
        {...(stroke != null ? { stroke } : {})}
        {...(strokeWidth != null ? { strokeWidth } : {})}
        {...(opacity != null ? { opacity } : {})}
      />
    );
  }

  if (shape === "square") {
    return (
      <rect
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        {...(cornerRadius != null ? { rx: cornerRadius } : {})}
        fill={fill}
        {...(fillOpacity != null ? { fillOpacity } : {})}
        {...(stroke != null ? { stroke } : {})}
        {...(strokeWidth != null ? { strokeWidth } : {})}
        {...(opacity != null ? { opacity } : {})}
      />
    );
  }

  return (
    <polygon
      points={polygonPoints({ shape, cx, cy, r })}
      fill={fill}
      {...(fillOpacity != null ? { fillOpacity } : {})}
      {...(stroke != null ? { stroke } : {})}
      {...(strokeWidth != null ? { strokeWidth } : {})}
      {...(opacity != null ? { opacity } : {})}
    />
  );
}
