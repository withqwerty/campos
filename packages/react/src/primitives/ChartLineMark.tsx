import type { ReactNode } from "react";

type SharedLineProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap?: "butt" | "round" | "square";
  strokeLinejoin?: "miter" | "round" | "bevel";
  strokeDasharray?: string;
  opacity?: number;
  markerEnd?: string;
  fill?: string;
};

type SegmentLineProps = SharedLineProps & {
  kind?: "segment";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type PathLineProps = SharedLineProps & {
  kind: "path";
  d: string;
};

export function ChartLineMark(props: SegmentLineProps | PathLineProps): ReactNode {
  if (props.kind === "path") {
    const {
      d,
      stroke,
      strokeWidth,
      strokeLinecap,
      strokeLinejoin,
      strokeDasharray,
      opacity,
    } = props;
    return (
      <path
        d={d}
        fill={props.fill ?? "none"}
        stroke={stroke}
        strokeWidth={strokeWidth}
        {...(strokeLinecap != null ? { strokeLinecap } : {})}
        {...(strokeLinejoin != null ? { strokeLinejoin } : {})}
        {...(strokeDasharray != null ? { strokeDasharray } : {})}
        {...(opacity != null ? { opacity } : {})}
      />
    );
  }

  const {
    x1,
    y1,
    x2,
    y2,
    stroke,
    strokeWidth,
    strokeLinecap,
    strokeLinejoin,
    strokeDasharray,
    opacity,
    markerEnd,
  } = props;
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      {...(strokeLinecap != null ? { strokeLinecap } : {})}
      {...(strokeLinejoin != null ? { strokeLinejoin } : {})}
      {...(strokeDasharray != null ? { strokeDasharray } : {})}
      {...(opacity != null ? { opacity } : {})}
      {...(markerEnd != null ? { markerEnd } : {})}
    />
  );
}
